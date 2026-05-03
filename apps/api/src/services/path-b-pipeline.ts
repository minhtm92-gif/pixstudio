/**
 * Path B reverse engineer pipeline (Sprints 30-35).
 *
 * Pipeline stages — each updates ReverseEngineerJob.progress:
 *   10%  Stage 1 — yt-dlp download video + audio extract → R2
 *   25%  Stage 2 — PySceneDetect scene boundaries
 *   45%  Stage 3 — ElevenLabs Scribe transcription (with timestamps)
 *   65%  Stage 4 — Replicate Demucs audio stem separation (optional, defer if no token)
 *   85%  Stage 5 — Gemini 2.5 Pro visual analysis per scene
 *   100% Stage 6 — Build editor state + create Project handoff
 *
 * Cost estimate per 1-min reference video:
 *   yt-dlp/ffmpeg: free (CPU local)
 *   ElevenLabs Scribe: ~$0.02
 *   Demucs (Replicate): ~$0.015
 *   Gemini Pro multimodal: ~$0.05
 *   Total: ~$0.08-0.10/min reference video
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";
import { runDemucs } from "./replicate-client.js";
import { apiEnv } from "../env.js";

interface PipelineContext {
	jobId: string;
	sessionId: string;
	sourceUrl: string;
	prisma: PrismaClient;
	r2: S3Client | null;
	r2Buckets: { uploads: string; renders: string; derived: string };
	logger: { info: (data: object, msg: string) => void; warn: (data: object, msg: string) => void; error: (data: object, msg: string) => void };
}

export interface SceneBoundary {
	id: string;
	order: number;
	startSec: number;
	endSec: number;
	durationSec: number;
}

export interface PathBExtraction {
	videoR2Key: string;
	audioR2Key: string;
	scenes: SceneBoundary[];
	transcript: Array<{ start: number; end: number; text: string }>;
	stems?: { vocals: string; drums: string; bass: string; other: string };
	visualAnalysis: Array<{ sceneId: string; description: string; mood: string; objects: string[] }>;
}

/**
 * Run shell command + capture stdout/stderr.
 */
function runCmd(cmd: string, args: string[], cwd?: string, timeoutMs = 600_000): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(cmd, args, { cwd, env: process.env });
		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (d) => { stdout += d.toString(); });
		proc.stderr.on("data", (d) => { stderr += d.toString(); });
		const timer = setTimeout(() => {
			proc.kill("SIGKILL");
			reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

class JobCancelledError extends Error {
	constructor(public jobId: string) {
		super(`Job ${jobId} cancelled`);
		this.name = "JobCancelledError";
	}
}

async function updateProgress(ctx: PipelineContext, progress: number, status?: string): Promise<void> {
	// Cooperative cancellation: read current status first; if user/admin cancelled
	// via /api/path-b/jobs/:id/cancel, exit pipeline early instead of clobbering.
	const current = await ctx.prisma.reverseEngineerJob.findUnique({
		where: { id: ctx.jobId },
		select: { status: true },
	});
	if (current?.status === "CANCELLED") {
		throw new JobCancelledError(ctx.jobId);
	}
	await ctx.prisma.reverseEngineerJob.update({
		where: { id: ctx.jobId },
		data: {
			progress,
			...(status ? { status: status as never } : {}),
		},
	});
}

export { JobCancelledError };

/**
 * Stage 1 — Download reference video via yt-dlp + extract audio via ffmpeg.
 * yt-dlp picks best mp4 + best m4a/aac audio. Extracted audio piped to mp3.
 */
async function stage1Download(ctx: PipelineContext, workDir: string): Promise<{ videoR2Key: string; audioR2Key: string }> {
	ctx.logger.info({ jobId: ctx.jobId, sourceUrl: ctx.sourceUrl }, "stage 1 — yt-dlp download");

	const videoPath = join(workDir, "video.mp4");
	const audioPath = join(workDir, "audio.mp3");

	// yt-dlp: best mp4, force mp4 container
	await runCmd(
		"yt-dlp",
		["-f", "best[ext=mp4]/best", "-o", videoPath, "--no-playlist", "--no-progress", ctx.sourceUrl],
		undefined,
		300_000,
	);

	// ffmpeg: extract mp3 audio
	await runCmd(
		"ffmpeg",
		["-i", videoPath, "-vn", "-acodec", "libmp3lame", "-q:a", "4", "-y", audioPath],
		undefined,
		180_000,
	);

	const videoR2Key = `path-b/${ctx.jobId}/source.mp4`;
	const audioR2Key = `path-b/${ctx.jobId}/source.mp3`;

	if (ctx.r2) {
		const videoBuf = await readFile(videoPath);
		const audioBuf = await readFile(audioPath);
		await ctx.r2.send(
			new PutObjectCommand({
				Bucket: ctx.r2Buckets.derived,
				Key: videoR2Key,
				Body: videoBuf,
				ContentType: "video/mp4",
			}),
		);
		await ctx.r2.send(
			new PutObjectCommand({
				Bucket: ctx.r2Buckets.derived,
				Key: audioR2Key,
				Body: audioBuf,
				ContentType: "audio/mpeg",
			}),
		);
	}

	const videoStat = await stat(videoPath);
	ctx.logger.info({ videoSize: videoStat.size, videoR2Key, audioR2Key }, "stage 1 done");
	return { videoR2Key, audioR2Key };
}

/**
 * Stage 2 — FFmpeg scene boundaries via select filter (CPU, ~5-10s).
 * Replaces PySceneDetect which needs opencv-headless compile on Alpine.
 *
 * FFmpeg flow:
 *   1. ffprobe → total duration
 *   2. ffmpeg -filter:v "select='gt(scene,0.4)',showinfo" → stderr emits
 *      pts_time markers at each scene change above threshold 0.4
 *   3. Parse pts_time → SceneBoundary[]
 */
async function stage2DetectScenes(workDir: string, ctx: PipelineContext): Promise<SceneBoundary[]> {
	ctx.logger.info({ jobId: ctx.jobId }, "stage 2 — FFmpeg scene detection");
	const videoPath = join(workDir, "video.mp4");

	// Probe total duration first
	const probe = await runCmd(
		"ffprobe",
		[
			"-v", "error",
			"-show_entries", "format=duration",
			"-of", "default=noprint_wrappers=1:nokey=1",
			videoPath,
		],
		undefined,
		30_000,
	);
	const totalDuration = parseFloat(probe.stdout.trim()) || 30;

	// Run scene detection — output goes to stderr.
	let sceneStderr = "";
	try {
		const result = await runCmd(
			"ffmpeg",
			[
				"-i", videoPath,
				"-filter:v", "select='gt(scene,0.4)',showinfo",
				"-f", "null",
				"-",
			],
			undefined,
			120_000,
		);
		sceneStderr = result.stderr;
	} catch (err) {
		ctx.logger.warn({ err: String(err) }, "ffmpeg scene detection raised — parsing partial stderr");
	}

	// Parse pts_time values from showinfo lines:
	// [Parsed_showinfo_1 @ ...] n: 0 pts: 12345 pts_time:1.234 ...
	const sceneTimes: number[] = [];
	const regex = /pts_time:([0-9]+\.?[0-9]*)/g;
	let m;
	while ((m = regex.exec(sceneStderr)) !== null) {
		const t = parseFloat(m[1] ?? "0");
		if (!isNaN(t) && t > 0) sceneTimes.push(t);
	}

	// Always include scene-1 starting at 0
	const starts = [0, ...sceneTimes];
	const scenes: SceneBoundary[] = starts.map((startSec, i) => {
		const endSec = starts[i + 1] ?? totalDuration;
		return {
			id: `scene-${i + 1}`,
			order: i + 1,
			startSec,
			endSec,
			durationSec: Math.max(0.5, endSec - startSec),
		};
	});

	ctx.logger.info({ sceneCount: scenes.length, totalDuration }, "stage 2 done");
	return scenes;
}

/**
 * Stage 3 — ElevenLabs Scribe transcription (replaces Whisper-large-v3 per anh).
 * Returns word-level timestamps converted to scene-boundary alignment.
 */
async function stage3Transcribe(audioR2Key: string, ctx: PipelineContext, workDir: string): Promise<Array<{ start: number; end: number; text: string }>> {
	ctx.logger.info({ jobId: ctx.jobId }, "stage 3 — ElevenLabs Scribe transcription");
	const apiKey = apiEnv.ELEVENLABS_API_KEY;
	if (!apiKey) {
		ctx.logger.warn({}, "ELEVENLABS_API_KEY not set — skipping transcription");
		return [];
	}

	const audioPath = join(workDir, "audio.mp3");
	const audioBuf = await readFile(audioPath);

	// ElevenLabs Scribe API
	const formData = new FormData();
	formData.append("file", new Blob([new Uint8Array(audioBuf)], { type: "audio/mpeg" }), "audio.mp3");
	formData.append("model_id", "scribe_v1");
	formData.append("timestamps_granularity", "word");

	const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
		method: "POST",
		headers: { "xi-api-key": apiKey },
		body: formData,
	});
	if (!resp.ok) {
		ctx.logger.error({ status: resp.status, body: await resp.text() }, "ElevenLabs Scribe failed");
		return [];
	}
	const json = (await resp.json()) as {
		text: string;
		words?: Array<{ text: string; start: number; end: number }>;
	};

	// Group words into sentences (~10s each) for scene-aligned segments
	const segments: Array<{ start: number; end: number; text: string }> = [];
	if (json.words && json.words.length > 0) {
		let chunk: typeof json.words = [];
		const SEGMENT_MAX_SEC = 10;
		for (const word of json.words) {
			chunk.push(word);
			const chunkStart = chunk[0]?.start ?? 0;
			if (word.end - chunkStart >= SEGMENT_MAX_SEC || word === json.words[json.words.length - 1]) {
				segments.push({
					start: chunkStart,
					end: word.end,
					text: chunk.map((w) => w.text).join(" ").trim(),
				});
				chunk = [];
			}
		}
	} else if (json.text) {
		segments.push({ start: 0, end: 0, text: json.text });
	}

	ctx.logger.info({ segmentCount: segments.length }, "stage 3 done");
	return segments;
}

/**
 * Stage 4 — Replicate Demucs audio stem separation (optional).
 */
async function stage4Demucs(audioR2Key: string, ctx: PipelineContext): Promise<PathBExtraction["stems"] | undefined> {
	if (!apiEnv.REPLICATE_API_TOKEN) {
		ctx.logger.warn({}, "REPLICATE_API_TOKEN not set — skipping Demucs (Path B works without stems)");
		return undefined;
	}
	if (!ctx.r2) return undefined;

	ctx.logger.info({ jobId: ctx.jobId }, "stage 4 — Replicate Demucs stem separation");
	try {
		// Construct R2 public URL (presigned would need separate import — skipping
		// for v1 since R2 buckets often have public read for derived/ folder)
		const audioUrl = `https://${ctx.r2Buckets.derived}.r2.cloudflarestorage.com/${audioR2Key}`;
		const result = await runDemucs(audioUrl);
		ctx.logger.info({ predictionId: result.predictionId, durationSec: result.durationSec }, "stage 4 done");
		return result.output;
	} catch (err) {
		ctx.logger.warn({ err: String(err) }, "stage 4 Demucs failed — pipeline continues");
		return undefined;
	}
}

/**
 * Stage 5 — Gemini visual analysis per scene.
 * Sends 1-2 keyframes per scene to Gemini 2.5 Pro multimodal for description.
 */
async function stage5VisualAnalysis(
	scenes: SceneBoundary[],
	workDir: string,
	ctx: PipelineContext,
): Promise<PathBExtraction["visualAnalysis"]> {
	if (!apiEnv.GEMINI_API_KEY) {
		ctx.logger.warn({}, "GEMINI_API_KEY not set — skipping visual analysis");
		return [];
	}

	ctx.logger.info({ jobId: ctx.jobId, sceneCount: scenes.length }, "stage 5 — Gemini visual analysis");
	const videoPath = join(workDir, "video.mp4");
	const results: PathBExtraction["visualAnalysis"] = [];

	for (const scene of scenes.slice(0, 20)) {
		// Cap at 20 scenes — long videos cost too much
		const keyframePath = join(workDir, `keyframe-${scene.id}.jpg`);
		const midSec = scene.startSec + scene.durationSec / 2;
		try {
			await runCmd(
				"ffmpeg",
				["-ss", String(midSec), "-i", videoPath, "-frames:v", "1", "-q:v", "2", "-y", keyframePath],
				undefined,
				30_000,
			);
			const imgBuf = await readFile(keyframePath);
			const base64 = imgBuf.toString("base64");

			const prompt = `Describe this video frame for a creator who wants to recreate similar content. Output JSON:
{
  "description": "1-2 sentence visual description (subject, setting, action)",
  "mood": "one of: upbeat, chill, cinematic, epic, comedic, romantic, tense, corporate",
  "objects": ["array", "of", "key", "objects/elements"]
}`;
			const resp = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiEnv.GEMINI_API_KEY}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{ text: prompt },
									{ inlineData: { mimeType: "image/jpeg", data: base64 } },
								],
							},
						],
						generationConfig: { responseMimeType: "application/json", maxOutputTokens: 200 },
					}),
				},
			);
			if (!resp.ok) {
				ctx.logger.warn({ sceneId: scene.id, status: resp.status }, "Gemini visual scene failed");
				continue;
			}
			const json = (await resp.json()) as {
				candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
			};
			const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
			const parsed = JSON.parse(text) as {
				description?: string;
				mood?: string;
				objects?: string[];
			};
			results.push({
				sceneId: scene.id,
				description: parsed.description ?? "",
				mood: parsed.mood ?? "neutral",
				objects: parsed.objects ?? [],
			});
		} catch (err) {
			ctx.logger.warn({ sceneId: scene.id, err: String(err) }, "scene visual failed");
		}
	}
	ctx.logger.info({ analyzedCount: results.length }, "stage 5 done");
	return results;
}

/**
 * Top-level pipeline orchestrator. Updates ReverseEngineerJob row at each stage.
 */
export async function runPathBPipeline(ctx: PipelineContext): Promise<PathBExtraction> {
	const workDir = join(tmpdir(), `path-b-${ctx.jobId}`);
	await mkdir(workDir, { recursive: true });

	try {
		await updateProgress(ctx, 5, "DOWNLOADING");
		const { videoR2Key, audioR2Key } = await stage1Download(ctx, workDir);
		await updateProgress(ctx, 25, "DETECTING_SCENES");
		const scenes = await stage2DetectScenes(workDir, ctx);
		await updateProgress(ctx, 45, "TRANSCRIBING");
		const transcript = await stage3Transcribe(audioR2Key, ctx, workDir);
		await updateProgress(ctx, 65, "SEPARATING_STEMS");
		const stems = await stage4Demucs(audioR2Key, ctx);
		await updateProgress(ctx, 85, "ANALYZING_VISUAL");
		const visualAnalysis = await stage5VisualAnalysis(scenes, workDir, ctx);
		await updateProgress(ctx, 100, "COMPLETED");

		return {
			videoR2Key,
			audioR2Key,
			scenes,
			transcript,
			stems,
			visualAnalysis,
		};
	} finally {
		// Clean up workdir
		await rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}
