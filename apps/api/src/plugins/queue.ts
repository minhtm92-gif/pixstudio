/**
 * BullMQ queue plugin — wires Quick Create build pipeline + future workers.
 *
 * Decorates Fastify với:
 *   - app.redis (ioredis client connected to Upstash)
 *   - app.queues.quickCreateBuild (BullMQ Queue cho 5-stage build pipeline)
 *
 * Workers run in same process Sprint 2.5 (low concurrency). Sprint 4+: dedicate
 * worker process for scaling + GPU-bound stages.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import IORedis from "ioredis";
import { Queue, Worker, type Job } from "bullmq";

declare module "fastify" {
	interface FastifyInstance {
		redis: IORedis;
		queues: {
			quickCreateBuild: Queue;
		};
		startQuickCreateBuildWorker: () => Worker;
	}
}

export interface QuickCreateBuildJobData {
	sessionId: string;
	workspaceId: string;
	userId: string;
}

export interface QuickCreateBuildJobReturn {
	projectId: string;
	totalCostUsd: number;
	totalDurationMs: number;
}

const queueImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
	// Upstash Redis: prefer REST URL when set, fallback to traditional Redis URL.
	const redisUrl =
		process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["REDIS_URL"];
	if (!redisUrl) {
		app.log.warn("UPSTASH_REDIS_REST_URL not set — BullMQ queue disabled");
		return;
	}

	// IORedis prefers redis:// or rediss:// URL. Upstash REST URL doesn't work
	// for BullMQ — anh need either direct Upstash Redis URL (rediss://) or
	// local Redis instance. Sprint 2.5 polish: detect URL type + warn.
	let redis: IORedis;
	if (redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")) {
		redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
	} else {
		app.log.warn(
			"UPSTASH_REDIS_REST_URL is REST not Redis protocol — BullMQ disabled. " +
				"Set REDIS_URL to a rediss://... endpoint cho BullMQ to work.",
		);
		return;
	}

	app.decorate("redis", redis);

	const quickCreateBuild = new Queue<QuickCreateBuildJobData, QuickCreateBuildJobReturn>(
		"quick-create-build",
		{
			connection: redis,
			defaultJobOptions: {
				attempts: 3,
				backoff: { type: "exponential", delay: 2000 },
				removeOnComplete: { count: 100, age: 24 * 60 * 60 },
				removeOnFail: { count: 200, age: 7 * 24 * 60 * 60 },
			},
		},
	);

	app.decorate("queues", { quickCreateBuild });

	app.decorate("startQuickCreateBuildWorker", () => {
		const worker = new Worker<QuickCreateBuildJobData, QuickCreateBuildJobReturn>(
			"quick-create-build",
			async (job) => processBuildJob(app, job),
			{ connection: redis, concurrency: 2 },
		);
		worker.on("failed", (job, err) => {
			app.log.error(
				{ jobId: job?.id, err },
				"quick-create-build worker job failed",
			);
		});
		worker.on("completed", (job, ret) => {
			app.log.info(
				{ jobId: job.id, ret },
				"quick-create-build worker job completed",
			);
		});
		return worker;
	});

	app.addHook("onClose", async () => {
		await quickCreateBuild.close();
		await redis.quit();
	});

	app.log.info("BullMQ queue ready: quick-create-build");
};

/**
 * 5-stage build pipeline (Sprint 2.5 mock — real wire-up Sprint 3-4).
 *
 * Updates session progress + buildStatus after each stage. Re-reads session
 * status before each stage so DELETE /build (Codex P1 #3) can abort even if
 * BullMQ job removal failed.
 */
class BuildCancelledError extends Error {
	constructor(public sessionId: string) {
		super(`build cancelled for session ${sessionId}`);
		this.name = "BuildCancelledError";
	}
}

async function processBuildJob(
	app: FastifyInstance,
	job: Job<QuickCreateBuildJobData, QuickCreateBuildJobReturn>,
): Promise<QuickCreateBuildJobReturn> {
	const { sessionId, userId, workspaceId } = job.data;

	const stages = [
		{ id: "GENERATING_SCRIPT", weight: 10 },
		{ id: "SYNTHESIZING_VOICE", weight: 25 },
		{ id: "MATCHING_STOCK", weight: 20 },
		{ id: "COMPOSING_SCENES", weight: 20 },
		{ id: "RENDERING_PREVIEW", weight: 25 },
	] as const;

	let cumulativeProgress = 0;
	const startedAt = Date.now();
	let totalCostUsd = 0;

	try {
		for (const stage of stages) {
			const current = await app.prisma.quickCreateSession.findUnique({
				where: { id: sessionId },
				select: { buildStatus: true, outlineJson: true, prompt: true },
			});
			if (current?.buildStatus === "CANCELLED") {
				throw new BuildCancelledError(sessionId);
			}

			await app.prisma.quickCreateSession.update({
				where: { id: sessionId },
				data: {
					buildStatus: stage.id as never,
					buildProgress: cumulativeProgress,
				},
			});

			// === Stage 1: REAL — polish outline scenes via LLM ===
			if (stage.id === "GENERATING_SCRIPT" && current?.outlineJson && app.aiRouter) {
				const outline = current.outlineJson as {
					scenes?: Array<{ id: string; script: string; order: number }>;
				} | null;
				if (outline?.scenes && outline.scenes.length > 0) {
					try {
						const polishPrompt = `You are a TTS-friendly script polisher for Vietnamese video ads.

Original scenes:
${outline.scenes.map((s) => `Scene ${s.order}: ${s.script}`).join("\n")}

Task: rewrite each scene script to be:
1. Voice-friendly (avoid abbreviations, expand numbers like "30%" → "ba mươi phần trăm")
2. Natural Vietnamese spoken cadence (not written formal)
3. Same length ±10% (don't significantly shorten or lengthen)
4. Keep all keywords + product names intact

Return JSON ONLY: {"scenes":[{"id":"scene-1","script":"polished text"},...]}`;

						const { result } = await app.aiRouter.invoke(
							"llm.chat" as never,
							{
								prompt: polishPrompt,
								maxTokens: 1500,
								temperature: 0.4,
								responseFormat: "json_object",
							} as never,
							{ tier: "pro", workspaceId, userId } as never,
						);
						const text = (result as { text?: string }).text ?? "";
						const cost = (result as { costUsd?: number }).costUsd ?? 0;
						totalCostUsd += cost;
						const jsonStart = text.indexOf("{");
						const jsonEnd = text.lastIndexOf("}");
						if (jsonStart !== -1 && jsonEnd !== -1) {
							const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
								scenes?: Array<{ id: string; script: string }>;
							};
							if (parsed.scenes) {
								// Merge polished scripts back into outline (preserve other fields).
								const polishedById = new Map(
									parsed.scenes.map((s) => [s.id, s.script]),
								);
								const updatedOutline = {
									...outline,
									scenes: outline.scenes.map((s) => ({
										...s,
										script: polishedById.get(s.id) ?? s.script,
									})),
								};
								await app.prisma.quickCreateSession.update({
									where: { id: sessionId },
									data: { outlineJson: updatedOutline as never },
								});
								app.log.info(
									{ sessionId, costUsd: cost, scenes: parsed.scenes.length },
									"stage 1 LLM script polish complete",
								);
							}
						}
					} catch (err) {
						app.log.warn(
							{ sessionId, err },
							"stage 1 LLM polish failed — using original scripts",
						);
					}
				}
			} else if (stage.id === "SYNTHESIZING_VOICE" && current?.outlineJson && app.aiRouter && app.r2) {
				// === Stage 2: REAL — ElevenLabs TTS per scene + R2 upload ===
				const outline = current.outlineJson as {
					scenes?: Array<{ id: string; script: string; order: number; audioR2Key?: string }>;
				} | null;
				const config = (await app.prisma.quickCreateSession.findUnique({
					where: { id: sessionId },
					select: { configOverrides: true },
				}))?.configOverrides as { voiceId?: string } | null;
				const voiceId = config?.voiceId ?? "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default Vietnamese-capable voice (Rachel)
				if (outline?.scenes && outline.scenes.length > 0) {
					try {
						const PutObjectCommand = (await import("@aws-sdk/client-s3")).PutObjectCommand;
						const updatedScenes = await Promise.all(
							outline.scenes.map(async (scene) => {
								try {
									const { result } = await app.aiRouter!.invoke(
										"tts.synthesize" as never,
										{
											text: scene.script,
											voiceId,
											outputFormat: "mp3_44100_128",
										} as never,
										{ tier: "pro", workspaceId, userId } as never,
									);
									const out = (result as { output?: { audioBytes: ArrayBuffer } }).output;
									const cost = (result as { costUsd?: number }).costUsd ?? 0;
									totalCostUsd += cost;
									if (!out?.audioBytes) return scene;
									const r2Key = `tts/${sessionId}/${scene.id}.mp3`;
									await app.r2!.send(
										new PutObjectCommand({
											Bucket: app.r2Buckets.uploads,
											Key: r2Key,
											Body: Buffer.from(out.audioBytes),
											ContentType: "audio/mpeg",
										}),
									);
									return { ...scene, audioR2Key: r2Key };
								} catch (err) {
									app.log.warn({ sessionId, sceneId: scene.id, err }, "TTS scene failed");
									return scene;
								}
							}),
						);
						await app.prisma.quickCreateSession.update({
							where: { id: sessionId },
							data: {
								outlineJson: { ...outline, scenes: updatedScenes } as never,
							},
						});
						app.log.info(
							{ sessionId, scenes: updatedScenes.length, withAudio: updatedScenes.filter((s) => s.audioR2Key).length },
							"stage 2 TTS complete",
						);
					} catch (err) {
						app.log.warn({ sessionId, err }, "stage 2 TTS batch failed");
					}
				}
			} else {
				// Stages 3-5 still mock — needs stock vendor APIs + FFmpeg compositor (full sprints)
				await new Promise((r) => setTimeout(r, 1500));
			}

			cumulativeProgress += stage.weight;
			await job.updateProgress(cumulativeProgress);
		}

		const totalDurationMs = Date.now() - startedAt;

		await app.prisma.quickCreateSession.update({
			where: { id: sessionId },
			data: {
				buildStatus: "COMPLETED" as never,
				buildProgress: 100,
				completedAt: new Date(),
				totalCostUsd: totalCostUsd as never,
			},
		});

		return {
			projectId: `mock-project-${sessionId}`,
			totalCostUsd,
			totalDurationMs,
		};
	} catch (err) {
		if (err instanceof BuildCancelledError) {
			app.log.info({ sessionId, jobId: job.id }, "build aborted — session was cancelled");
			return {
				projectId: `cancelled-${sessionId}`,
				totalCostUsd: 0,
				totalDurationMs: Date.now() - startedAt,
			};
		}
		throw err;
	}
}

export default fp(queueImpl, { name: "queue", dependencies: ["prisma"] });
