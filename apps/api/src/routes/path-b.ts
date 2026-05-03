/**
 * Path B reverse engineer routes — Sprints 28 + 30-35.
 *
 *   GET  /api/path-b/jobs/:id          — poll status (Sprint 28 UI)
 *   POST /api/path-b/jobs/:id/run      — admin trigger pipeline run
 *   POST /api/path-b/jobs/:id/handoff  — convert COMPLETED → Project for editor
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireAdmin } from "../plugins/require-auth.js";
import { runPathBPipeline, type PathBExtraction } from "../services/path-b-pipeline.js";

export const pathBRoutes: FastifyPluginAsyncZod = async (app) => {
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
					await app.prisma.reverseEngineerJob.update({
						where: { id: job.id },
						data: {
							status: "COMPLETED",
							progress: 100,
							completedAt: new Date(),
							outputEditorStateJson: buildEditorStateFromExtraction(extraction) as never,
						},
					});
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

			return { projectId: project.id, editorUrl: `/editor/${project.id}` };
		},
	});
};

function buildEditorStateFromExtraction(ext: PathBExtraction) {
	const totalDuration = ext.scenes.reduce((s, sc) => s + sc.durationSec, 0);
	return {
		version: 1,
		title: "Reverse engineered from reference",
		totalDurationSec: totalDuration,
		sourceVideoR2Key: ext.videoR2Key,
		tracks: [
			{
				id: "video-1",
				kind: "video",
				segments: ext.scenes.map((sc) => {
					const visual = ext.visualAnalysis.find((v) => v.sceneId === sc.id);
					return {
						id: `seg-video-${sc.id}`,
						sceneId: sc.id,
						startSec: sc.startSec,
						durationSec: sc.durationSec,
						sourceTrim: { fromSec: sc.startSec, toSec: sc.endSec },
						visualHint: visual ?? null,
					};
				}),
			},
			{
				id: "audio-source",
				kind: "audio",
				segments: [
					{
						id: "seg-audio-source",
						startSec: 0,
						durationSec: totalDuration,
						r2Key: ext.audioR2Key,
						stems: ext.stems ?? null,
					},
				],
			},
			{
				id: "subtitle-1",
				kind: "subtitle",
				segments: ext.transcript.map((seg, i) => ({
					id: `seg-sub-${i}`,
					startSec: seg.start,
					durationSec: Math.max(0, seg.end - seg.start),
					text: seg.text,
					style: { font: "Bebas Neue", size: 64, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 4 },
				})),
			},
		],
		extractionMeta: {
			sceneCount: ext.scenes.length,
			transcriptSegments: ext.transcript.length,
			visualAnalyzed: ext.visualAnalysis.length,
			hasStems: !!ext.stems,
		},
	};
}
