/**
 * Path B final render — concatenate replacement clips, mix new voice-over track,
 * burn translated subtitles, upload MP4 to R2 renders bucket. Runs in BullMQ
 * worker (machine-kill resilient via pattern B4).
 *
 * Inputs:
 *   - editor state JSON (scenes ordered + scripts)
 *   - replacement R2 keys per scene (anh-uploaded Envato clips)
 *   - voice-over R2 key (from /api/captions/voice-over)
 *   - caption preset id (FFmpeg force_style)
 *   - aspect ratio (1080x1920 / 1920x1080 / 1080x1080 / 1080x1350)
 *
 * Output: MP4 at R2 renders bucket key `renders/path-b/<projectId>/<jobId>.mp4`.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { findCaptionPreset } from "../data/caption-presets.js";

export type PathBAspect = "16:9" | "9:16" | "1:1" | "4:5";

const ASPECT_DIMENSIONS: Record<PathBAspect, { w: number; h: number }> = {
	"16:9": { w: 1920, h: 1080 },
	"9:16": { w: 1080, h: 1920 },
	"1:1": { w: 1080, h: 1080 },
	"4:5": { w: 1080, h: 1350 },
};

interface SceneInput {
	id: string;
	order: number;
	durationSec: number;
	script: string;
}

export interface PathBRenderParams {
	projectId: string;
	jobId: string;
	scenes: SceneInput[];
	replacementR2KeysByScene: Record<string, string>;
	/** Concatenated single voice-over track — used when caller already merged. */
	voiceOverR2Key: string | null;
	/** Per-scene voice-over MP3 R2 keys — render service concats by scene order. */
	voiceOverR2KeysByScene: Record<string, string>;
	captionPresetId: string;
	aspectRatio: PathBAspect;
}

export interface PathBRenderResult {
	renderR2Key: string;
	durationSec: number;
	sizeBytes: number;
}

interface RenderContext {
	r2: S3Client;
	r2Buckets: { uploads: string; renders: string; derived: string };
	logger: { info: (data: object, msg: string) => void; warn: (data: object, msg: string) => void; error: (data: object, msg: string) => void };
}

function runCmd(cmd: string, args: string[], timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(cmd, args);
		let stderr = "";
		proc.stderr.on("data", (d) => { stderr += d.toString(); });
		const timer = setTimeout(() => {
			proc.kill("SIGKILL");
			reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(`${cmd} exit ${code}: ${stderr.slice(-400)}`));
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

async function downloadR2(
	r2: S3Client,
	bucket: string,
	key: string,
	dest: string,
): Promise<void> {
	const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	if (!obj.Body) throw new Error(`R2 object ${key} empty`);
	const buf = Buffer.from(await obj.Body.transformToByteArray());
	await writeFile(dest, buf);
}

function srtTime(sec: number): string {
	const h = Math.floor(sec / 3600).toString().padStart(2, "0");
	const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
	const ms = Math.round((sec % 60) * 1000);
	const s = Math.floor(ms / 1000).toString().padStart(2, "0");
	const milli = (ms % 1000).toString().padStart(3, "0");
	return `${h}:${m}:${s},${milli}`;
}

function buildSrt(scenes: SceneInput[]): string {
	let cursor = 0;
	const lines: string[] = [];
	scenes.forEach((sc, i) => {
		const start = cursor;
		const end = cursor + sc.durationSec;
		lines.push(`${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${sc.script.slice(0, 200)}\n`);
		cursor = end;
	});
	return lines.join("\n");
}

export async function renderPathBFinal(
	ctx: RenderContext,
	params: PathBRenderParams,
): Promise<PathBRenderResult> {
	const { w, h } = ASPECT_DIMENSIONS[params.aspectRatio];
	const preset = findCaptionPreset(params.captionPresetId) ?? findCaptionPreset("minimal-clean");
	const forceStyle = preset?.ffmpegForceStyle ?? "";

	const workDir = join(tmpdir(), `path-b-render-${params.jobId}`);
	await mkdir(workDir, { recursive: true });

	try {
		ctx.logger.info(
			{ jobId: params.jobId, sceneCount: params.scenes.length, aspect: params.aspectRatio },
			"path-b render: start",
		);

		// 1. Download + transcode each replacement clip to canonical format (matched
		//    aspect, h264, fixed duration). Skips scenes without replacement (those
		//    fall back to a black canvas with the same duration so timing aligns).
		const transcodedPaths: string[] = [];
		for (const scene of params.scenes) {
			const replacementKey = params.replacementR2KeysByScene[scene.id];
			const inputPath = join(workDir, `in-${scene.id}.mp4`);
			const outPath = join(workDir, `clip-${scene.order}.mp4`);

			if (replacementKey) {
				await downloadR2(ctx.r2, ctx.r2Buckets.uploads, replacementKey, inputPath);
				await runCmd(
					"ffmpeg",
					[
						"-y", "-i", inputPath,
						"-t", scene.durationSec.toFixed(3),
						"-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
						"-r", "30",
						"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
						"-an",
						outPath,
					],
					300_000,
				);
			} else {
				await runCmd(
					"ffmpeg",
					[
						"-y", "-f", "lavfi",
						"-i", `color=c=black:s=${w}x${h}:d=${scene.durationSec}:r=30`,
						"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
						outPath,
					],
					60_000,
				);
			}
			transcodedPaths.push(outPath);
		}

		// 2. Concat transcoded clips via demuxer (all share same codec/dimensions).
		const concatList = join(workDir, "concat-list.txt");
		await writeFile(
			concatList,
			transcodedPaths.map((p) => `file '${p.replace(/'/g, "\\''")}'`).join("\n"),
		);
		const videoConcatPath = join(workDir, "video-concat.mp4");
		await runCmd(
			"ffmpeg",
			["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", videoConcatPath],
			120_000,
		);

		// 3. Voice-over audio. Per-scene map (preferred) → download each MP3 in
		// scene order then ffmpeg-concat → single voice-over track. Legacy single
		// `voiceOverR2Key` still supported for callers that pre-merged.
		let voiceOverPath: string | null = null;
		const perSceneVoiceKeys = params.scenes
			.map((s) => params.voiceOverR2KeysByScene?.[s.id])
			.filter((k): k is string => !!k);
		if (perSceneVoiceKeys.length > 0) {
			const downloadedPaths: string[] = [];
			for (let i = 0; i < perSceneVoiceKeys.length; i++) {
				const dst = join(workDir, `vo-${i}.mp3`);
				await downloadR2(ctx.r2, ctx.r2Buckets.derived, perSceneVoiceKeys[i]!, dst);
				downloadedPaths.push(dst);
			}
			const voList = join(workDir, "vo-list.txt");
			await writeFile(
				voList,
				downloadedPaths.map((p) => `file '${p.replace(/'/g, "\\''")}'`).join("\n"),
			);
			voiceOverPath = join(workDir, "voice-over.mp3");
			await runCmd(
				"ffmpeg",
				["-y", "-f", "concat", "-safe", "0", "-i", voList, "-c", "copy", voiceOverPath],
				120_000,
			);
		} else if (params.voiceOverR2Key) {
			voiceOverPath = join(workDir, "voice-over.mp3");
			await downloadR2(ctx.r2, ctx.r2Buckets.derived, params.voiceOverR2Key, voiceOverPath);
		}

		// 4. Build subtitle SRT.
		const srtPath = join(workDir, "subs.srt");
		await writeFile(srtPath, buildSrt(params.scenes));

		// 5. Final mux: video + voice-over + burned subtitles.
		const totalDuration = params.scenes.reduce((s, sc) => s + sc.durationSec, 0);
		const outputPath = join(workDir, "final.mp4");
		const subtitleFilter = `subtitles='${srtPath.replace(/'/g, "\\''")}'${forceStyle ? `:force_style='${forceStyle}'` : ""}`;

		const finalArgs = [
			"-y",
			"-i", videoConcatPath,
			...(voiceOverPath ? ["-i", voiceOverPath] : []),
			"-vf", subtitleFilter,
			"-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
			...(voiceOverPath
				? ["-c:a", "aac", "-b:a", "128k", "-map", "0:v:0", "-map", "1:a:0", "-shortest"]
				: ["-an"]),
			"-t", totalDuration.toFixed(3),
			outputPath,
		];
		await runCmd("ffmpeg", finalArgs, 600_000);

		// 6. Upload to R2 renders bucket.
		const buf = await readFile(outputPath);
		const renderR2Key = `renders/path-b/${params.projectId}/${params.jobId}.mp4`;
		await ctx.r2.send(
			new PutObjectCommand({
				Bucket: ctx.r2Buckets.renders,
				Key: renderR2Key,
				Body: buf,
				ContentType: "video/mp4",
			}),
		);
		ctx.logger.info(
			{ jobId: params.jobId, renderR2Key, sizeBytes: buf.length, totalDuration },
			"path-b render: done",
		);

		return {
			renderR2Key,
			durationSec: totalDuration,
			sizeBytes: buf.length,
		};
	} finally {
		await rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}
