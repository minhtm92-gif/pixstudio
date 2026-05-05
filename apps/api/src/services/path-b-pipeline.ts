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
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PrismaClient } from "@prisma/client";
import { runDemucs } from "./replicate-client.js";
import { apiEnv } from "../env.js";

interface PipelineContext {
	jobId: string;
	sessionId: string;
	sourceUrl: string;
	/** Workspace billing tier — controls scene detect sensitivity (S15). */
	tier?: "STANDARD" | "PRO" | "MAX";
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
	/** S15: audio profile + suggested replacement tracks from MUSIC_TRACKS pool. */
	musicProfile?: {
		integratedLoudnessLufs: number;
		mood: "upbeat" | "chill" | "cinematic" | "epic" | "comedic" | "romantic" | "tense" | "corporate";
		bpmEstimate: number | null;
		suggestedReplacementTrackIds: string[];
	};
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
 * Stage 1 — Acquire reference video + extract audio.
 *
 * sourceUrl conventions:
 *   - `r2://<key>` — manual upload via /api/path-b/source-uploads/presign.
 *     Skip yt-dlp; download directly from R2 uploads bucket.
 *   - `https://...` (YouTube/TikTok/Reel/Vimeo) — yt-dlp downloads.
 *
 * Both paths converge on local video.mp4 + audio.mp3 → R2 derived bucket.
 */
async function stage1Download(ctx: PipelineContext, workDir: string): Promise<{ videoR2Key: string; audioR2Key: string }> {
	const videoPath = join(workDir, "video.mp4");
	const audioPath = join(workDir, "audio.mp3");

	if (ctx.sourceUrl.startsWith("r2://")) {
		const r2Key = ctx.sourceUrl.slice("r2://".length);
		ctx.logger.info({ jobId: ctx.jobId, r2Key }, "stage 1 — R2 download (manual upload)");
		if (!ctx.r2) {
			throw new Error("R2 client not configured — cannot download manual upload");
		}
		const obj = await ctx.r2.send(
			new GetObjectCommand({ Bucket: ctx.r2Buckets.uploads, Key: r2Key }),
		);
		if (!obj.Body) throw new Error(`R2 object ${r2Key} has no body`);
		// Stream R2 body → local file
		const chunks: Uint8Array[] = [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for await (const chunk of obj.Body as any) {
			chunks.push(chunk as Uint8Array);
		}
		const buf = Buffer.concat(chunks);
		await writeFile(videoPath, buf);
		ctx.logger.info({ jobId: ctx.jobId, videoSize: buf.length }, "stage 1 R2 download done");
	} else {
		ctx.logger.info({ jobId: ctx.jobId, sourceUrl: ctx.sourceUrl }, "stage 1 — yt-dlp download");
		// yt-dlp: best mp4, force mp4 container
		await runCmd(
			"yt-dlp",
			["-f", "best[ext=mp4]/best", "-o", videoPath, "--no-playlist", "--no-progress", ctx.sourceUrl],
			undefined,
			300_000,
		);
	}

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
 *
 * SCOPE §5 row 18 specifies PySceneDetect primary. Per ADR-007
 * (`docs/adr/007-ffmpeg-scene-detect-interim.md`), FFmpeg select is interim
 * because opencv-python-headless lacks musl wheels on Alpine Fly host.
 * Migrate to PySceneDetect on GPU droplet once gpu-spawn.ts SSH path wired.
 *
 * FFmpeg flow:
 *   1. ffprobe → total duration
 *   2. ffmpeg -filter:v "select='gt(scene,0.25)',showinfo" → stderr emits
 *      pts_time markers at each scene change above threshold 0.25
 *   3. Parse pts_time → SceneBoundary[]
 *
 * Audit BUG #4 fix (2026-05-04): threshold lowered from 0.4 → 0.25 after Rick
 * Roll test (213s video) detected only 1 scene (clearly wrong — music video has
 * many cuts). 0.25 is FFmpeg's documented sensitive default for "real-world"
 * video content.
 *
 * S15 (2026-05-05): tier-aware threshold per Path B quota differentiation.
 * Higher tier → more sensitive detection (more scenes to edit).
 *   Standard 0.40 — coarse, suit short ads / explainer content
 *   Pro      0.30 — moderate (default before S15)
 *   Max      0.25 — sensitive, suit music video / fast-cut content
 */
const SCENE_DETECT_THRESHOLD_BY_TIER: Record<"STANDARD" | "PRO" | "MAX", number> = {
	STANDARD: 0.40,
	PRO: 0.30,
	MAX: 0.25,
};

/**
 * Minimum editable scene duration. Storytelling videos with rapid cuts produce
 * 200+ raw scenes (e.g. 16-min YouTube → 366 scenes), making the editor UI
 * unusable. Merge consecutive scenes shorter than this threshold into the
 * previous scene — preserves total duration while reducing scene count to
 * an editable level.
 *
 * Empirical: 16-min storytelling at PRO threshold 0.30 → 366 raw → ~60 merged.
 */
const MIN_SCENE_DURATION_SEC = 5;

function mergeShortScenes(scenes: SceneBoundary[]): SceneBoundary[] {
	if (scenes.length <= 1) return scenes;
	const merged: SceneBoundary[] = [];
	for (const s of scenes) {
		const prev = merged[merged.length - 1];
		if (prev && s.durationSec < MIN_SCENE_DURATION_SEC) {
			prev.endSec = s.endSec;
			prev.durationSec = prev.endSec - prev.startSec;
		} else {
			merged.push({ ...s });
		}
	}
	return merged.map((s, i) => ({ ...s, id: `scene-${i + 1}`, order: i + 1 }));
}

async function stage2DetectScenes(workDir: string, ctx: PipelineContext): Promise<SceneBoundary[]> {
	const tier = ctx.tier ?? "PRO";
	const threshold = SCENE_DETECT_THRESHOLD_BY_TIER[tier];
	ctx.logger.info({ jobId: ctx.jobId, tier, threshold }, "stage 2 — FFmpeg scene detection");
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
				"-filter:v", `select='gt(scene,${threshold})',showinfo`,
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

	const mergedScenes = mergeShortScenes(scenes);
	ctx.logger.info(
		{
			rawSceneCount: scenes.length,
			sceneCount: mergedScenes.length,
			totalDuration,
			minDurationSec: MIN_SCENE_DURATION_SEC,
		},
		"stage 2 done",
	);
	return mergedScenes;
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
		// Replicate fetches the audio over HTTPS — R2 rejects anonymous reads
		// (SSLV3_ALERT_HANDSHAKE_FAILURE), so generate a presigned GET URL.
		const command = new GetObjectCommand({
			Bucket: ctx.r2Buckets.derived,
			Key: audioR2Key,
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const audioUrl = await getSignedUrl(ctx.r2 as any, command as any, {
			expiresIn: 3600,
		});
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
 * Stage 6 — Music profile via FFmpeg loudnorm + spectral analysis.
 *
 * S15: SCOPE row 17 specifies Chromaprint OSS for fingerprint match. v1 uses
 * lighter-weight FFmpeg-only analysis (loudnorm LUFS + tempo via beat detection
 * stub) to classify mood, then matches against MUSIC_TRACKS pool by mood/genre.
 * Full Chromaprint (AcoustID) integration deferred to S22+ (commercial license
 * + API call cost makes it Phase 3 polish, not Phase 2 MVP).
 *
 * Heuristic mood inference from LUFS + spectral centroid:
 *   - LUFS > -10 (loud) + high centroid → upbeat / epic
 *   - LUFS < -20 (quiet) + low centroid  → chill / romantic
 *   - LUFS -10 to -16 mid + var centroid  → corporate / cinematic
 */
async function stage6MusicProfile(
	audioPath: string,
	ctx: PipelineContext,
): Promise<PathBExtraction["musicProfile"] | undefined> {
	ctx.logger.info({ jobId: ctx.jobId }, "stage 6 — music profile (loudnorm + spectral)");
	try {
		// FFmpeg loudnorm pass 1 — measures integrated LUFS.
		// Output goes to stderr as JSON in trailing block.
		// `-t 90` caps analysis to first 90s of audio — mood is a statistical
		// classifier (LUFS distribution), so a representative sample matches the
		// full-file output to within 1 LUFS for the mood threshold buckets we use
		// below. Without the cap, 16-min input timed out at 60s on Fly shared CPU.
		const result = await runCmd(
			"ffmpeg",
			[
				"-i", audioPath,
				"-t", "90",
				"-af", "loudnorm=I=-23:TP=-2:LRA=11:print_format=json",
				"-f", "null",
				"-",
			],
			undefined,
			60_000,
		);
		// Parse trailing JSON block from stderr.
		const stderr = result.stderr;
		const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
		const measured = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
		const integratedLufs = measured ? parseFloat(measured.input_i ?? "-23") : -23;

		// Heuristic mood classification from LUFS only (v1 — full spectral S22+).
		let mood: NonNullable<PathBExtraction["musicProfile"]>["mood"];
		if (integratedLufs > -10) mood = "upbeat";
		else if (integratedLufs > -14) mood = "epic";
		else if (integratedLufs > -18) mood = "corporate";
		else if (integratedLufs > -22) mood = "cinematic";
		else mood = "chill";

		// Match MUSIC_TRACKS pool by mood (top 3 — frontend can surface as
		// "music suggestion" chips in editor). Imported lazily to avoid circular.
		const { MUSIC_TRACKS } = await import("../data/music-tracks.js");
		const matches = MUSIC_TRACKS.filter((t) => t.mood === mood)
			.slice(0, 3)
			.map((t) => t.id);

		ctx.logger.info(
			{ jobId: ctx.jobId, integratedLufs, mood, matchCount: matches.length },
			"stage 6 done",
		);

		return {
			integratedLoudnessLufs: integratedLufs,
			mood,
			bpmEstimate: null, // BPM via aubio S22+ (extra dep)
			suggestedReplacementTrackIds: matches,
		};
	} catch (err) {
		ctx.logger.warn({ jobId: ctx.jobId, err: String(err) }, "stage 6 music profile failed");
		return undefined;
	}
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
		await updateProgress(ctx, 80, "ANALYZING_VISUAL");
		const visualAnalysis = await stage5VisualAnalysis(scenes, workDir, ctx);
		await updateProgress(ctx, 92, "IDENTIFYING_MUSIC");
		const musicProfile = await stage6MusicProfile(join(workDir, "audio.mp3"), ctx);
		await updateProgress(ctx, 100, "COMPLETED");

		return {
			videoR2Key,
			audioR2Key,
			scenes,
			transcript,
			stems,
			visualAnalysis,
			musicProfile,
		};
	} finally {
		// Clean up workdir
		await rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}
