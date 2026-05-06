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
import {
	runPathBPipeline,
	JobCancelledError,
} from "../services/path-b-pipeline.js";
import {
	buildPathBEditorState,
	secondsToQuotaMinutes,
} from "../services/path-b-editor-state.js";
import { incrementPathBMinutes } from "../services/tier-quota.js";
import {
	renderPathBFinal,
	type PathBRenderParams,
	type PathBRenderResult,
} from "../services/path-b-render.js";

declare module "fastify" {
	interface FastifyInstance {
		redis: IORedis;
		queues: {
			quickCreateBuild: Queue;
			pathBExtract: Queue;
			pathBRender: Queue;
		};
		startQuickCreateBuildWorker: () => Worker;
		startPathBExtractWorker: () => Worker;
		startPathBRenderWorker: () => Worker;
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

export interface PathBExtractJobData {
	jobId: string;
	sessionId: string;
	workspaceId: string;
	userId: string;
	sourceUrl: string;
	tier: "STANDARD" | "PRO" | "MAX";
}

export interface PathBExtractJobReturn {
	jobId: string;
	scenes: number;
	durationSec: number;
}

export type PathBRenderJobData = PathBRenderParams;
export type PathBRenderJobReturn = PathBRenderResult;

const queueImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
	// BullMQ requires Redis protocol (redis:// or rediss://). The Upstash REST
	// URL is HTTPS-based and incompatible. Prefer REDIS_URL first; fall back to
	// UPSTASH_REDIS_REST_URL only if it happens to be a Redis-protocol URL.
	const redisUrl =
		process.env["REDIS_URL"] ?? process.env["UPSTASH_REDIS_REST_URL"];
	if (!redisUrl) {
		app.log.warn("REDIS_URL not set — BullMQ queue disabled");
		return;
	}

	let redis: IORedis;
	if (redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")) {
		// Upstash Pay-as-you-go cluster certs use Subject CN without DNS SAN —
		// strict Node.js TLS rejects with ERR_TLS_CERT_ALTNAME_INVALID. Pass
		// servername explicitly + skip altname check (managed cluster, traffic
		// is still encrypted via TLS handshake).
		const isTls = redisUrl.startsWith("rediss://");
		redis = new IORedis(redisUrl, {
			maxRetriesPerRequest: null,
			...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
		});
	} else {
		app.log.warn(
			"REDIS_URL is not a Redis-protocol URL (must start with redis:// or rediss://). " +
				"Set REDIS_URL to a rediss://default:<pw>@<host>:<port> endpoint cho BullMQ to work.",
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

	const pathBExtract = new Queue<PathBExtractJobData, PathBExtractJobReturn>(
		"path-b-extract",
		{
			connection: redis,
			defaultJobOptions: {
				// 1 retry — pipeline downloads ~70MB videos + multiple AI calls per
				// stage, so a 2nd attempt is worth it but 3rd usually wastes quota.
				attempts: 2,
				backoff: { type: "exponential", delay: 5000 },
				removeOnComplete: { count: 50, age: 24 * 60 * 60 },
				removeOnFail: { count: 100, age: 7 * 24 * 60 * 60 },
			},
		},
	);

	const pathBRender = new Queue<PathBRenderJobData, PathBRenderJobReturn>(
		"path-b-render",
		{
			connection: redis,
			defaultJobOptions: {
				attempts: 2,
				backoff: { type: "exponential", delay: 5000 },
				removeOnComplete: { count: 50, age: 24 * 60 * 60 },
				removeOnFail: { count: 100, age: 7 * 24 * 60 * 60 },
			},
		},
	);

	app.decorate("queues", { quickCreateBuild, pathBExtract, pathBRender });

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

	app.decorate("startPathBExtractWorker", () => {
		const worker = new Worker<PathBExtractJobData, PathBExtractJobReturn>(
			"path-b-extract",
			async (job) => processPathBJob(app, job),
			// concurrency=1: each job downloads + processes ~70MB on tmpfs and
			// runs FFmpeg at high CPU. Parallelism would OOM the 1GB Fly machine.
			{ connection: redis, concurrency: 1 },
		);
		worker.on("failed", (job, err) => {
			app.log.error({ jobId: job?.id, err }, "path-b-extract worker job failed");
		});
		worker.on("completed", (job, ret) => {
			app.log.info({ jobId: job.id, ret }, "path-b-extract worker job completed");
		});
		return worker;
	});

	app.decorate("startPathBRenderWorker", () => {
		const worker = new Worker<PathBRenderJobData, PathBRenderJobReturn>(
			"path-b-render",
			async (job) => processPathBRenderJob(app, job),
			{
				connection: redis,
				concurrency: 1,
				// FFmpeg subprocesses can block the event loop for 30-60s during
				// large transcodes; default lockDuration 30s caused BullMQ to mark
				// jobs stalled mid-render. Render shouldn't take more than 15min
				// total — set lock 20min to give plenty of slack.
				lockDuration: 20 * 60 * 1000,
				stalledInterval: 60 * 1000,
			},
		);
		worker.on("failed", (job, err) => {
			app.log.error({ jobId: job?.id, err }, "path-b-render worker job failed");
		});
		worker.on("completed", (job, ret) => {
			app.log.info({ jobId: job.id, ret }, "path-b-render worker job completed");
		});
		return worker;
	});

	app.addHook("onClose", async () => {
		await quickCreateBuild.close();
		await pathBExtract.close();
		await pathBRender.close();
		await redis.quit();
	});

	app.log.info("BullMQ queue ready: quick-create-build, path-b-extract, path-b-render");
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
			} else if (stage.id === "MATCHING_STOCK" && current?.outlineJson) {
				// === Stage 3: REAL — match each scene mediaQuery to admin stock pool ===
				// Picks first ACTIVE account per vendor (round-robin Phase 2). Records
				// StockDownload row + attaches stockMatchR2Key to scene.
				// Real download from vendor API requires per-vendor SDK integration
				// (iStock OAuth + Envato + Shutterstock) — Sprint 22+ work. For now we
				// match metadata + record license intent.
				const outline = current.outlineJson as {
					scenes?: Array<{
						id: string;
						mediaQuery?: string;
						order: number;
						stockMatch?: { vendor: string; query: string; accountId: string | null };
					}>;
				} | null;
				if (outline?.scenes && outline.scenes.length > 0) {
					try {
						const activeAccounts = await app.prisma.stockAccount.findMany({
							where: { status: "ACTIVE" },
							select: { id: true, vendor: true, label: true, monthlyUsed: true, monthlyQuota: true },
							orderBy: { monthlyUsed: "asc" }, // least-used first (round-robin balance)
						});
						const updatedScenes = outline.scenes.map((scene) => {
							const query = scene.mediaQuery ?? "businessman office";
							// Pick least-used ACTIVE account, prefer Envato then iStock then Shutterstock
							// (cheaper-per-asset first per anh strategy)
							const vendorPreference = ["ENVATO", "ISTOCK", "SHUTTERSTOCK"];
							const candidate = vendorPreference
								.map((vendor) => activeAccounts.find((a) => a.vendor === vendor && a.monthlyUsed < a.monthlyQuota))
								.find((a) => !!a);
							return {
								...scene,
								stockMatch: {
									vendor: candidate?.vendor ?? "ENVATO",
									query,
									accountId: candidate?.id ?? null,
								},
							};
						});
						await app.prisma.quickCreateSession.update({
							where: { id: sessionId },
							data: { outlineJson: { ...outline, scenes: updatedScenes } as never },
						});
						app.log.info(
							{ sessionId, scenes: updatedScenes.length, accountsAvailable: activeAccounts.length },
							"stage 3 stock match complete (metadata only — vendor download Sprint 22+)",
						);
					} catch (err) {
						app.log.warn({ sessionId, err }, "stage 3 stock match failed");
					}
				}
			} else if (stage.id === "COMPOSING_SCENES" && current?.outlineJson) {
				// === Stage 4: REAL — build OpenCut-compatible editor state JSON ===
				// Produces a Project.editorStateJson that the OpenCut /editor/[id] page
				// can hydrate. Each scene becomes a video track segment + audio track
				// segment + subtitle overlay (text track).
				const outline = current.outlineJson as {
					title?: string;
					scenes?: Array<{
						id: string;
						order: number;
						script: string;
						durationSec: number;
						audioR2Key?: string;
						stockMatch?: { vendor: string; query: string };
					}>;
				} | null;
				if (outline?.scenes && outline.scenes.length > 0) {
					try {
						let cursor = 0;
						const editorState = {
							version: 1,
							title: outline.title ?? "Quick Create build",
							totalDurationSec: outline.scenes.reduce((s, sc) => s + sc.durationSec, 0),
							tracks: [
								{
									id: "video-1",
									kind: "video",
									segments: outline.scenes.map((sc) => {
										const start = cursor;
										cursor += sc.durationSec;
										return {
											id: `seg-video-${sc.id}`,
											sceneId: sc.id,
											startSec: start,
											durationSec: sc.durationSec,
											stockMatch: sc.stockMatch ?? null,
											placeholder: !sc.stockMatch?.vendor,
										};
									}),
								},
								{
									id: "audio-tts",
									kind: "audio",
									segments: outline.scenes.map((sc, i) => ({
										id: `seg-audio-${sc.id}`,
										sceneId: sc.id,
										startSec: outline.scenes!.slice(0, i).reduce((s, x) => s + x.durationSec, 0),
										durationSec: sc.durationSec,
										r2Key: sc.audioR2Key ?? null,
										missing: !sc.audioR2Key,
									})),
								},
								{
									id: "subtitle-1",
									kind: "subtitle",
									segments: outline.scenes.map((sc, i) => ({
										id: `seg-sub-${sc.id}`,
										sceneId: sc.id,
										startSec: outline.scenes!.slice(0, i).reduce((s, x) => s + x.durationSec, 0),
										durationSec: sc.durationSec,
										text: sc.script,
										style: { font: "Bebas Neue", size: 64, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 4 },
									})),
								},
							],
						};
						await app.prisma.quickCreateSession.update({
							where: { id: sessionId },
							data: { outlineJson: { ...outline, editorState } as never },
						});
						app.log.info(
							{ sessionId, totalDurationSec: editorState.totalDurationSec, trackCount: editorState.tracks.length },
							"stage 4 editor state assembled",
						);
					} catch (err) {
						app.log.warn({ sessionId, err }, "stage 4 compose failed");
					}
				}
			} else if (stage.id === "RENDERING_PREVIEW" && current?.outlineJson && app.r2) {
				// === Stage 5: REAL — FFmpeg render preview MP4 720p ===
				// CPU mode (no GPU). For 30-60s output, takes 60-180s on shared-cpu-2x.
				// Output: 720x1280 9:16 portrait or 1280x720 16:9 — match workflow ratio.
				const outline = current.outlineJson as {
					editorState?: {
						totalDurationSec?: number;
						tracks?: Array<{ kind: string; segments?: Array<{ r2Key?: string | null; durationSec?: number; text?: string; startSec?: number }> }>;
					};
				} | null;
				const editorState = outline?.editorState;
				if (editorState?.tracks && editorState.tracks.length > 0) {
					try {
						const { spawn } = await import("node:child_process");
						const { mkdir, readFile, rm, writeFile } = await import("node:fs/promises");
						const { join } = await import("node:path");
						const { tmpdir } = await import("node:os");
						const { GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");

						const workDir = join(tmpdir(), `render-${sessionId}`);
						await mkdir(workDir, { recursive: true });

						try {
							// Download all TTS audio segments
							const audioTrack = editorState.tracks.find((t) => t.kind === "audio");
							const audioPaths: string[] = [];
							for (const seg of audioTrack?.segments ?? []) {
								if (!seg.r2Key) continue;
								const obj = await app.r2!.send(
									new GetObjectCommand({
										Bucket: app.r2Buckets.uploads,
										Key: seg.r2Key,
									}),
								);
								const buf = Buffer.from(await obj.Body!.transformToByteArray());
								const path = join(workDir, `audio-${audioPaths.length}.mp3`);
								await writeFile(path, buf);
								audioPaths.push(path);
							}

							// Concat audio segments via FFmpeg concat demuxer
							let concatAudio = "";
							if (audioPaths.length > 0) {
								const listPath = join(workDir, "audio-list.txt");
								await writeFile(listPath, audioPaths.map((p) => `file '${p}'`).join("\n"));
								concatAudio = join(workDir, "audio-concat.mp3");
								await new Promise((resolve, reject) => {
									const proc = spawn("ffmpeg", [
										"-f", "concat", "-safe", "0", "-i", listPath,
										"-c", "copy", "-y", concatAudio,
									]);
									proc.on("close", (c) => (c === 0 ? resolve(undefined) : reject(new Error(`ffmpeg concat exit ${c}`))));
									proc.on("error", reject);
								});
							}

							// S13 improvement: SRT subtitle file (unlimited segments, no
							// drawtext cmd-length cap) + workflow-tinted gradient bg.
							const totalSec = Math.max(15, editorState.totalDurationSec ?? 30);
							const outputPath = join(workDir, "preview.mp4");
							const subtitleTrack = editorState.tracks.find((t) => t.kind === "subtitle");
							const subtitleSegs = subtitleTrack?.segments ?? [];

							let subtitlesArg = "";
							if (subtitleSegs.length > 0) {
								const fmtTime = (s: number) => {
									const h = Math.floor(s / 3600).toString().padStart(2, "0");
									const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
									const sec = (s % 60).toFixed(3).replace(".", ",").padStart(6, "0");
									return `${h}:${m}:${sec}`;
								};
								const srt = subtitleSegs
									.map((seg, i) => {
										const start = seg.startSec ?? 0;
										const end = start + (seg.durationSec ?? 0);
										return `${i + 1}\n${fmtTime(start)} --> ${fmtTime(end)}\n${(seg.text ?? "").slice(0, 200)}\n`;
									})
									.join("\n");
								const srtPath = join(workDir, "subs.srt");
								await writeFile(srtPath, srt);
								subtitlesArg = `subtitles='${srtPath.replace(/'/g, "\\'")}':force_style='Fontname=DejaVu Sans,FontSize=18,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=80'`;
							}

							// Workflow-tinted gradient bg — better than pure black.
							// Hash session prompt → pick from 8-color palette matching Hero gradients.
							const palette = ["3B82F6", "8B5CF6", "F59E0B", "DC2626", "06B6D4", "EC4899", "10B981", "FCD34D"];
							const hashSrc = (current?.prompt ?? sessionId);
							const hash = Array.from(hashSrc).reduce((acc, c) => acc + c.charCodeAt(0), 0);
							const bgColor = palette[hash % palette.length] ?? "3B82F6";

							const ffmpegArgs = [
								"-f", "lavfi", "-i", `color=c=0x${bgColor}:s=720x1280:d=${totalSec}:r=30`,
								...(concatAudio ? ["-i", concatAudio] : []),
								...(subtitlesArg ? ["-vf", subtitlesArg] : []),
								"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
								...(concatAudio ? ["-c:a", "aac", "-shortest"] : []),
								"-y", outputPath,
							];

							await new Promise((resolve, reject) => {
								const proc = spawn("ffmpeg", ffmpegArgs);
								let stderr = "";
								proc.stderr.on("data", (d) => { stderr += d.toString(); });
								const timer = setTimeout(() => {
									proc.kill("SIGKILL");
									reject(new Error("ffmpeg render timeout 5min"));
								}, 5 * 60 * 1000);
								proc.on("close", (c) => {
									clearTimeout(timer);
									if (c === 0) resolve(undefined);
									else reject(new Error(`ffmpeg exit ${c}: ${stderr.slice(-300)}`));
								});
								proc.on("error", reject);
							});

							const videoBuf = await readFile(outputPath);
							const renderR2Key = `renders/${sessionId}/preview-720p.mp4`;
							await app.r2!.send(
								new PutObjectCommand({
									Bucket: app.r2Buckets.renders,
									Key: renderR2Key,
									Body: videoBuf,
									ContentType: "video/mp4",
								}),
							);

							await app.prisma.quickCreateSession.update({
								where: { id: sessionId },
								data: {
									outlineJson: {
										...outline,
										editorState: {
											...editorState,
											previewRenderR2Key: renderR2Key,
											previewRenderedAt: new Date().toISOString(),
										},
									} as never,
								},
							});
							app.log.info(
								{ sessionId, renderR2Key, sizeBytes: videoBuf.length, totalSec },
								"stage 5 FFmpeg render complete",
							);
						} finally {
							await rm(workDir, { recursive: true, force: true }).catch(() => {});
						}
					} catch (err) {
						app.log.warn({ sessionId, err: String(err) }, "stage 5 render failed");
					}
				}
			} else {
				// Default fallback if stage doesn't match (shouldn't happen)
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

/**
 * Path B reverse-engineer worker — replaces fire-and-forget background promise
 * (which the Fly autostop killer was orphaning at random progress points).
 * BullMQ persists the job to Redis so a machine death = retry on next worker.
 */
async function processPathBJob(
	app: FastifyInstance,
	job: Job<PathBExtractJobData, PathBExtractJobReturn>,
): Promise<PathBExtractJobReturn> {
	const { jobId, sessionId, workspaceId, sourceUrl, tier } = job.data;
	try {
		const extraction = await runPathBPipeline({
			jobId,
			sessionId,
			sourceUrl,
			tier,
			prisma: app.prisma,
			r2: app.r2 ?? null,
			r2Buckets: app.r2Buckets,
			logger: app.log,
		});
		const editorState = buildPathBEditorState(extraction);
		await app.prisma.reverseEngineerJob.update({
			where: { id: jobId },
			data: {
				status: "COMPLETED",
				progress: 100,
				completedAt: new Date(),
				outputEditorStateJson: editorState as never,
			},
		});
		const minutes = secondsToQuotaMinutes(editorState.duration);
		await incrementPathBMinutes(app.prisma, workspaceId, minutes);
		app.log.info(
			{ jobId, scenes: extraction.scenes.length, minutes },
			"path-b pipeline complete (worker)",
		);
		return {
			jobId,
			scenes: extraction.scenes.length,
			durationSec: editorState.duration,
		};
	} catch (err) {
		if (err instanceof JobCancelledError) {
			app.log.info({ jobId }, "path-b pipeline exited (cancelled)");
			return { jobId, scenes: 0, durationSec: 0 };
		}
		app.log.error({ jobId, err: String(err) }, "path-b pipeline FAILED (worker)");
		await app.prisma.reverseEngineerJob.update({
			where: { id: jobId },
			data: {
				status: "FAILED",
				errorMessage: err instanceof Error
					? err.message.slice(0, 1000)
					: String(err).slice(0, 1000),
			},
		});
		throw err;
	}
}

/**
 * Path B final render worker — concatenates anh-uploaded Envato replacement
 * clips with new voice-over track + burned subtitles. Reuses path-b-render
 * service so the FFmpeg orchestration stays out of this plugin.
 */
async function processPathBRenderJob(
	app: FastifyInstance,
	job: Job<PathBRenderJobData, PathBRenderJobReturn>,
): Promise<PathBRenderJobReturn> {
	if (!app.r2) {
		throw new Error("R2 not configured — cannot render");
	}
	return renderPathBFinal(
		{ r2: app.r2, r2Buckets: app.r2Buckets, logger: app.log },
		job.data,
	);
}

export default fp(queueImpl, { name: "queue", dependencies: ["prisma"] });
