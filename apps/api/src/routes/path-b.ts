/**
 * Path B reverse engineer routes — Sprints 28 + 30-35.
 *
 *   GET  /api/path-b/jobs/:id          — poll status (Sprint 28 UI)
 *   POST /api/path-b/jobs/:id/run      — admin trigger pipeline run
 *   POST /api/path-b/jobs/:id/handoff  — convert COMPLETED → Project for editor
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser, requireAdmin } from "../plugins/require-auth.js";
import { runPathBPipeline } from "../services/path-b-pipeline.js";
import {
	buildPathBEditorState,
	secondsToQuotaMinutes,
} from "../services/path-b-editor-state.js";
import { incrementPathBMinutes } from "../services/tier-quota.js";

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
				sizeBytes: z.number().int().positive().max(500 * 1024 * 1024),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}
			const safeName = req.body.filename
				.slice(-60)
				.replace(/[^a-zA-Z0-9.-]/g, "_");
			const r2Key = `path-b/source-uploads/${req.body.workspaceId}/${Date.now()}-${safeName}`;
			const command = new PutObjectCommand({
				Bucket: app.r2Buckets.uploads,
				Key: r2Key,
				ContentType: req.body.mimeType,
				ContentLength: req.body.sizeBytes,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const presignedUrl = await getSignedUrl(app.r2 as any, command as any, {
				expiresIn: 1200, // 20 min — large videos take longer to upload
			});
			req.log.info(
				{ userId: user.id, workspaceId: req.body.workspaceId, sizeBytes: req.body.sizeBytes },
				"path-b source-upload presign issued",
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

			const sourceUrl = job.sourceUrl;
			const workspaceId = job.workspaceId;
			void (async () => {
				try {
					const extraction = await runPathBPipeline({
						jobId: job.id,
						sessionId: job.sessionId,
						sourceUrl,
						prisma: app.prisma,
						r2: app.r2 ?? null,
						r2Buckets: app.r2Buckets,
						logger: app.log,
					});
					const editorState = buildPathBEditorState(extraction);
					await app.prisma.reverseEngineerJob.update({
						where: { id: job.id },
						data: {
							status: "COMPLETED",
							progress: 100,
							completedAt: new Date(),
							outputEditorStateJson: editorState as never,
						},
					});
					await incrementPathBMinutes(
						app.prisma,
						workspaceId,
						secondsToQuotaMinutes(editorState.duration),
					);
				} catch (err) {
					app.log.error({ jobId: job.id, err }, "Path B pipeline failed");
					await app.prisma.reverseEngineerJob.update({
						where: { id: job.id },
						data: {
							status: "FAILED",
							errorMessage: err instanceof Error ? err.message : String(err),
						},
					});
				}
			})();

			reply.code(202);
			return {
				jobId: job.id,
				status: "RUNNING",
				message: "Pipeline started. Poll GET /api/path-b/jobs/:id for progress.",
			};
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
};

