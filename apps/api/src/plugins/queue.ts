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
 * Updates session progress + buildStatus after each stage.
 */
async function processBuildJob(
	app: FastifyInstance,
	job: Job<QuickCreateBuildJobData, QuickCreateBuildJobReturn>,
): Promise<QuickCreateBuildJobReturn> {
	const { sessionId } = job.data;

	const stages = [
		{ id: "GENERATING_SCRIPT", weight: 10 },
		{ id: "SYNTHESIZING_VOICE", weight: 25 },
		{ id: "MATCHING_STOCK", weight: 20 },
		{ id: "COMPOSING_SCENES", weight: 20 },
		{ id: "RENDERING_PREVIEW", weight: 25 },
	] as const;

	let cumulativeProgress = 0;
	const startedAt = Date.now();

	for (const stage of stages) {
		await app.prisma.quickCreateSession.update({
			where: { id: sessionId },
			data: {
				buildStatus: stage.id as never,
				buildProgress: cumulativeProgress,
			},
		});

		// TODO Sprint 3-4: replace with real stage handlers (LLM script polish,
		// ElevenLabs TTS, stock match, compositor JSON build, MP4 render).
		await new Promise((r) => setTimeout(r, 1500)); // simulate stage work

		cumulativeProgress += stage.weight;
		await job.updateProgress(cumulativeProgress);
	}

	const totalDurationMs = Date.now() - startedAt;

	// Sprint 4: create real Project row from outline + assets. Mock for now.
	await app.prisma.quickCreateSession.update({
		where: { id: sessionId },
		data: {
			buildStatus: "COMPLETED" as never,
			buildProgress: 100,
			completedAt: new Date(),
		},
	});

	return {
		projectId: `mock-project-${sessionId}`,
		totalCostUsd: 0.05,
		totalDurationMs,
	};
}

export default fp(queueImpl, { name: "queue", dependencies: ["prisma"] });
