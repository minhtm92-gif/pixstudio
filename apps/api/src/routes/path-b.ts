/**
 * Path B reverse engineer routes — Sprints 28 + 30-35.
 *
 *   GET  /api/path-b/jobs/:id          — poll status (Sprint 28 UI)
 *   POST /api/path-b/jobs/:id/run      — admin trigger pipeline run
 *   POST /api/path-b/jobs/:id/handoff  — convert COMPLETED → Project for editor
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser, requireAdmin } from "../plugins/require-auth.js";

export const pathBRoutes: FastifyPluginAsyncZod = async (app) => {
	// POST /source-uploads/presign — Path B manual MP4 upload (SCOPE §13 D37
	// "drag-drop MP4 hoặc URL"). Returns R2 presigned PUT URL. Frontend uploads
	// directly, then submits POST /api/quick-create/sessions with
	// pathBSourceR2Key. Pipeline Stage 1 detects r2:// prefix and skips yt-dlp.
	app.post("/source-uploads/presign", {
		schema: {
			body: z.object({
				workspaceId: z.string().uuid(),
				filename: z.string().min(1).max(200),
				mimeType: z.enum([
					"video/mp4",
					"video/quicktime",
					"video/x-matroska",
					"video/webm",
				]),
				sizeBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
				kind: z.enum(["source-upload", "manual-stock"]).default("source-upload"),
				jobId: z.string().uuid().optional(),
				sceneId: z.string().min(1).max(60).optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}
			if (req.body.kind === "manual-stock" && (!req.body.jobId || !req.body.sceneId)) {
				reply.code(400);
				return { error: "manual-stock kind requires jobId + sceneId" };
			}
			const safeName = req.body.filename
				.slice(-60)
				.replace(/[^a-zA-Z0-9.-]/g, "_");
			const r2Key = req.body.kind === "manual-stock"
				? `path-b/manual-stock/${req.body.jobId}/${req.body.sceneId}-${Date.now()}-${safeName}`
				: `path-b/source-uploads/${req.body.workspaceId}/${Date.now()}-${safeName}`;
			const command = new PutObjectCommand({
				Bucket: app.r2Buckets.uploads,
				Key: r2Key,
				ContentType: req.body.mimeType,
				ContentLength: req.body.sizeBytes,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const presignedUrl = await getSignedUrl(app.r2 as any, command as any, {
				expiresIn: 1200,
			});
			req.log.info(
				{
					userId: user.id,
					workspaceId: req.body.workspaceId,
					kind: req.body.kind,
					sizeBytes: req.body.sizeBytes,
				},
				"path-b presign issued",
			);
			return { presignedUrl, r2Key, expiresInSec: 1200 };
		},
	});


	// Admin: list all ReverseEngineerJobs for monitoring queue (no auth-by-owner)
	app.get("/admin/jobs", {
		schema: {
			querystring: z.object({
				limit: z.coerce.number().int().min(1).max(100).default(20),
				status: z
					.enum([
						"PENDING",
						"DOWNLOADING",
						"EXTRACTING_AUDIO",
						"DETECTING_SCENES",
						"SEPARATING_STEMS",
						"TRANSCRIBING",
						"IDENTIFYING_MUSIC",
						"ANALYZING_VISUAL",
						"BUILDING_STATE",
						"COMPLETED",
						"FAILED",
						"CANCELLED",
					])
					.optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const where: Record<string, unknown> = {};
			if (req.query.status) where["status"] = req.query.status;
			const jobs = await app.prisma.reverseEngineerJob.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: req.query.limit,
			});
			return {
				items: jobs.map((j) => ({
					id: j.id,
					sessionId: j.sessionId,
					userId: j.userId,
					status: j.status,
					progress: j.progress,
					sourceUrl: j.sourceUrl,
					errorMessage: j.errorMessage,
					totalCostUsd: Number(j.totalCostUsd),
					createdAt: j.createdAt.toISOString(),
					completedAt: j.completedAt?.toISOString() ?? null,
				})),
			};
		},
	});

	app.get("/jobs/:id", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { id: req.params.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "Job not found" };
			}
			if (job.userId !== user.id) {
				reply.code(403);
				return { error: "Not your job" };
			}
			return {
				id: job.id,
				sessionId: job.sessionId,
				status: job.status,
				progress: job.progress,
				sourceUrl: job.sourceUrl,
				errorMessage: job.errorMessage,
				totalCostUsd: Number(job.totalCostUsd),
				createdAt: job.createdAt.toISOString(),
				completedAt: job.completedAt?.toISOString() ?? null,
			};
		},
	});

	app.post("/jobs/:id/run", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { id: req.params.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "Job not found" };
			}
			const inProgress = job.status !== "PENDING" && job.status !== "FAILED" && job.status !== "CANCELLED";
			if (inProgress) {
				reply.code(409);
				return { error: `Job already ${job.status}` };
			}
			if (!job.sourceUrl) {
				reply.code(400);
				return { error: "Job has no sourceUrl" };
			}

			await app.prisma.reverseEngineerJob.update({
				where: { id: job.id },
				data: { status: "DOWNLOADING", progress: 1 },
			});

			// S15: pull workspace tier for scene-detect sensitivity tuning.
			const ws = await app.prisma.workspace.findUnique({
				where: { id: job.workspaceId },
				select: { billingTier: true },
			});
			const tier = (ws?.billingTier ?? "PRO") as "STANDARD" | "PRO" | "MAX";
			// B4: enqueue to BullMQ — see processPathBJob in plugins/queue.ts.
			if (app.queues?.pathBExtract) {
				await app.queues.pathBExtract.add(
					"extract",
					{
						jobId: job.id,
						sessionId: job.sessionId,
						workspaceId: job.workspaceId,
						userId: user.id,
						sourceUrl: job.sourceUrl,
						tier,
					},
					{ jobId: job.id },
				);
			} else {
				reply.code(503);
				return { error: "BullMQ queue unavailable" };
			}

			reply.code(202);
			return {
				jobId: job.id,
				status: "RUNNING",
				message: "Pipeline started. Poll GET /api/path-b/jobs/:id for progress.",
			};
		},
	});

	// GET /projects/:projectId/stock-keywords — derive Envato search URL per
	// scene from the Project's *current* editor state (which already reflects
	// step-2 translate output — EN scripts give better Envato results than the
	// original VN). Used by the Replace-cảnh manual loop.
	app.get("/projects/:projectId/stock-keywords", {
		schema: { params: z.object({ projectId: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.projectId },
				select: { id: true, workspaceId: true, editorStateJson: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const state = project.editorStateJson as
				| {
					timeline?: {
						scenes?: Array<{
							id: string;
							order: number;
							durationSec: number;
							script?: string;
							mediaQuery?: string;
							mood?: string | null;
							objects?: string[];
						}>;
					};
				}
				| null;
			const scenes = state?.timeline?.scenes ?? [];
			const STOP_WORDS = new Set([
				"the", "a", "an", "and", "or", "but", "for", "with", "from", "into",
				"of", "to", "in", "on", "at", "by", "is", "was", "are", "were",
				"be", "been", "being", "this", "that", "these", "those", "it",
				"its", "as", "if", "so", "not", "no", "do", "does", "did", "have",
				"has", "had", "will", "would", "can", "could", "should", "you",
				"your", "we", "our", "they", "their", "i", "my",
			]);
			const items = scenes.map((s) => {
				// Prefer Stage 5 objects when available; else extract content words
				// from the (translated) script.
				let keywords: string[] = (s.objects ?? []).slice(0, 4);
				if (keywords.length === 0 && s.script) {
					const words = s.script
						.toLowerCase()
						.replace(/[^\p{L}\s]/gu, " ")
						.split(/\s+/)
						.filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
					const seen = new Set<string>();
					keywords = [];
					for (const w of words) {
						if (seen.has(w)) continue;
						seen.add(w);
						keywords.push(w);
						if (keywords.length >= 4) break;
					}
				}
				const queryStr = keywords.join(" ");
				const envatoSearchUrl = queryStr
					? `https://elements.envato.com/stock-video/${encodeURIComponent(queryStr)}`
					: null;
				return {
					sceneId: s.id,
					order: s.order,
					durationSec: s.durationSec,
					script: s.script ?? "",
					description: s.mediaQuery ?? "",
					mood: s.mood ?? null,
					objects: s.objects ?? [],
					keywords,
					envatoSearchUrl,
				};
			});
			return { projectId: project.id, items };
		},
	});

	// GET /jobs/:id/stock-keywords — derive Envato Elements search URL per scene
	// from the visual analysis stage 5 output. Frontend / curl helper consumes
	// this to render the Replace-cảnh manual loop.
	app.get("/jobs/:id/stock-keywords", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { id: req.params.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "Job not found" };
			}
			if (job.userId !== user.id) {
				reply.code(403);
				return { error: "Not your job" };
			}
			const state = job.outputEditorStateJson as
				| {
					timeline?: {
						scenes?: Array<{
							id: string;
							order: number;
							durationSec: number;
							mediaQuery?: string;
							mood?: string | null;
							objects?: string[];
						}>;
					};
				}
				| null;
			const scenes = state?.timeline?.scenes ?? [];
			const items = scenes.map((s) => {
				const objects = s.objects ?? [];
				// Pick first 3 most descriptive objects (skip generic words). Falls back
				// to mediaQuery first phrase if objects empty.
				const keywords = objects.slice(0, 3);
				const queryStr = keywords.length > 0
					? keywords.join(" ")
					: (s.mediaQuery ?? "").split(/[.,;]/)[0]?.trim().slice(0, 60) ?? "";
				const envatoSearchUrl = queryStr
					? `https://elements.envato.com/stock-video/${encodeURIComponent(queryStr)}`
					: null;
				return {
					sceneId: s.id,
					order: s.order,
					durationSec: s.durationSec,
					description: s.mediaQuery ?? "",
					mood: s.mood ?? null,
					objects,
					keywords,
					envatoSearchUrl,
				};
			});
			return { jobId: job.id, items };
		},
	});

	app.post("/jobs/:id/cancel", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { id: req.params.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "Job not found" };
			}
			if (job.userId !== user.id) {
				// Allow admin to cancel any user's job
				const dbUser = await app.prisma.user.findUnique({
					where: { id: user.id },
					select: { systemRole: true },
				});
				if (dbUser?.systemRole !== "ADMIN") {
					reply.code(403);
					return { error: "Not your job" };
				}
			}
			if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
				reply.code(409);
				return { error: `Job already ${job.status}` };
			}

			await app.prisma.reverseEngineerJob.update({
				where: { id: job.id },
				data: {
					status: "CANCELLED",
					errorMessage: "Cancelled by user",
					completedAt: new Date(),
				},
			});

			req.log.info({ jobId: job.id }, "path-b job cancelled by user");

			return {
				jobId: job.id,
				status: "CANCELLED",
				message: "Pipeline marked CANCELLED. Background process will exit at next stage check.",
			};
		},
	});

	app.post("/jobs/:id/handoff", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { id: req.params.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "Job not found" };
			}
			if (job.userId !== user.id) {
				reply.code(403);
				return { error: "Not your job" };
			}
			if (job.status !== "COMPLETED") {
				reply.code(400);
				return { error: `Job not complete (status=${job.status})` };
			}
			if (!job.outputEditorStateJson) {
				reply.code(400);
				return { error: "Job has no editor state" };
			}

			const project = await app.prisma.project.create({
				data: {
					workspaceId: job.workspaceId,
					name: `Path B: ${job.sourceUrl?.slice(0, 60) ?? "reverse engineer"}`,
					description: `From reference: ${job.sourceUrl ?? "unknown"}`,
					editorStateJson: job.outputEditorStateJson as never,
					editorStateVersion: 1,
					lastEditedAt: new Date(),
				},
			});

			// Route to Quick Create Editor (3-tab View 6 per SCOPE §13), not OpenCut
			// Pro Workspace. Path B uses "path-b" as workflowId pseudo-token.
			return {
				projectId: project.id,
				editorUrl: `/quick-create/workflows/path-b/editor?projectId=${project.id}`,
			};
		},
	});

	// POST /api/path-b/projects/:projectId/render-final — enqueue final-render job.
	// Body holds the per-scene replacement R2 keys + voice-over R2 key + caption
	// preset id + aspect. Worker (queue.ts processPathBRenderJob) does the FFmpeg
	// orchestration via path-b-render service.
	app.post("/projects/:projectId/render-final", {
		schema: {
			params: z.object({ projectId: z.string().uuid() }),
			body: z.object({
				replacementR2KeysByScene: z.record(z.string(), z.string()).default({}),
				voiceOverR2Key: z.string().nullable().default(null),
				voiceOverR2KeysByScene: z.record(z.string(), z.string()).default({}),
				captionPresetId: z.string().min(1).default("minimal-clean"),
				aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const project = await app.prisma.project.findUnique({
				where: { id: req.params.projectId },
				select: {
					id: true,
					workspaceId: true,
					editorStateJson: true,
				},
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}

			const editorState = project.editorStateJson as
				| {
					timeline?: {
						scenes?: Array<{
							id: string;
							order: number;
							durationSec: number;
							script?: string;
						}>;
					};
				}
				| null;
			const scenes = editorState?.timeline?.scenes ?? [];
			if (scenes.length === 0) {
				reply.code(400);
				return { error: "Project has no Path B scenes — run extraction first" };
			}

			if (!app.queues?.pathBRender) {
				reply.code(503);
				return { error: "BullMQ render queue unavailable" };
			}

			const renderJobId = crypto.randomUUID();
			await app.queues.pathBRender.add(
				"render",
				{
					projectId: project.id,
					jobId: renderJobId,
					scenes: scenes.map((s) => ({
						id: s.id,
						order: s.order,
						durationSec: s.durationSec,
						script: s.script ?? "",
					})),
					replacementR2KeysByScene: req.body.replacementR2KeysByScene,
					voiceOverR2Key: req.body.voiceOverR2Key,
					voiceOverR2KeysByScene: req.body.voiceOverR2KeysByScene,
					captionPresetId: req.body.captionPresetId,
					aspectRatio: req.body.aspectRatio,
				},
				{ jobId: renderJobId },
			);

			req.log.info(
				{
					projectId: project.id,
					renderJobId,
					sceneCount: scenes.length,
					replacementCount: Object.keys(req.body.replacementR2KeysByScene).length,
					hasVoiceOver: !!req.body.voiceOverR2Key,
				},
				"path-b render enqueued",
			);

			return {
				renderJobId,
				status: "QUEUED",
				message: "Render queued. Poll GET /api/path-b/render-jobs/:id for status.",
			};
		},
	});

	// GET /api/path-b/render-jobs/:id — poll a queued render job.
	app.get("/render-jobs/:id", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!app.queues?.pathBRender) {
				reply.code(503);
				return { error: "Render queue unavailable" };
			}
			const job = await app.queues.pathBRender.getJob(req.params.id);
			if (!job) {
				reply.code(404);
				return { error: "Render job not found" };
			}
			const state = await job.getState();
			const result = job.returnvalue;
			let signedUrl: string | null = null;
			if (state === "completed" && result?.renderR2Key && app.r2) {
				const command = new GetObjectCommand({
					Bucket: app.r2Buckets.renders,
					Key: result.renderR2Key,
				});
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				signedUrl = await getSignedUrl(app.r2 as any, command as any, {
					expiresIn: 3600,
				});
			}
			return {
				renderJobId: req.params.id,
				state,
				progress: job.progress,
				result: result ?? null,
				signedUrl,
				failedReason: job.failedReason ?? null,
			};
		},
	});
};

