/**
 * Magic tools API — Editor advanced features powered by Replicate (Phase 4) +
 * built-in FFmpeg filters.
 *
 *   POST /api/magic/segment      — SAM 2 background remove / object segment
 *   POST /api/magic/upscale      — Real-ESRGAN super-resolution
 *   POST /api/magic/interpolate  — RIFE smooth motion
 *   POST /api/magic/blur-bg      — FFmpeg boxblur (PW-24, S20)
 *   POST /api/magic/stabilize    — FFmpeg deshake (PW-25, S20)
 *
 * All endpoints:
 *   - Auth required (workspace member)
 *   - Tier gate: PRO/MAX only (STANDARD blocked with 402)
 *   - Optional `persistAsAsset: true` body → upload to R2 + create Asset row +
 *     return assetId for editor timeline insertion.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";
import { runSam2Segment, runRealEsrgan, runRifeInterpolation } from "../services/replicate-client.js";
import { saveAssetFromUrl } from "../services/asset-from-url.js";

const SegmentBodySchema = z.object({
	workspaceId: z.string().uuid(),
	imageUrl: z.string().url(),
	clickPoints: z
		.array(z.object({ x: z.number().int(), y: z.number().int(), positive: z.boolean() }))
		.min(1)
		.max(20),
});

const UpscaleBodySchema = z.object({
	workspaceId: z.string().uuid(),
	imageUrl: z.string().url(),
	scale: z.union([z.literal(2), z.literal(4)]).default(2),
});

const InterpolateBodySchema = z.object({
	workspaceId: z.string().uuid(),
	videoUrl: z.string().url(),
	multiplier: z.union([z.literal(2), z.literal(4), z.literal(8)]).default(2),
});

// S20 PW-24: Blur background (FFmpeg boxblur filter, full-frame v1).
const BlurBgBodySchema = z.object({
	workspaceId: z.string().uuid(),
	projectId: z.string().uuid().optional(),
	/** R2 key OR public URL of source video. */
	videoR2Key: z.string().min(1),
	/** Box blur radius — 5 (subtle) … 30 (heavy). */
	blurRadius: z.number().int().min(2).max(40).default(15),
	persistAsAsset: z.boolean().default(true),
});

// S20 PW-25: Video stabilizer (FFmpeg deshake filter, no vid.stab dep).
const StabilizeBodySchema = z.object({
	workspaceId: z.string().uuid(),
	projectId: z.string().uuid().optional(),
	videoR2Key: z.string().min(1),
	/** Deshake search range — higher = more aggressive, slower. */
	searchRange: z.number().int().min(8).max(64).default(16),
	persistAsAsset: z.boolean().default(true),
});

async function checkProTier(
	app: { prisma: { workspace: { findUnique: (args: { where: { id: string }; select: { billingTier: true } }) => Promise<{ billingTier: string } | null> } } },
	workspaceId: string,
): Promise<boolean> {
	const ws = await app.prisma.workspace.findUnique({
		where: { id: workspaceId },
		select: { billingTier: true },
	});
	return ws?.billingTier === "PRO" || ws?.billingTier === "MAX";
}

/**
 * Run FFmpeg with given args — capture stderr, fail on non-zero exit.
 */
function runFfmpeg(args: string[], timeoutMs = 5 * 60 * 1000): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn("ffmpeg", args);
		let stderr = "";
		proc.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		const timer = setTimeout(() => {
			proc.kill("SIGKILL");
			reject(new Error(`ffmpeg timeout ${timeoutMs}ms`));
		}, timeoutMs);
		proc.on("close", (c) => {
			clearTimeout(timer);
			if (c === 0) resolve();
			else reject(new Error(`ffmpeg exit ${c}: ${stderr.slice(-300)}`));
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

/**
 * S20 helper — pull video from R2 → run FFmpeg filter → upload + create Asset.
 * Used by /blur-bg and /stabilize endpoints.
 */
async function ffmpegFilterRoute(opts: {
	app: import("fastify").FastifyInstance;
	req: import("fastify").FastifyRequest;
	r2Key: string;
	workspaceId: string;
	projectId: string | undefined;
	persistAsAsset: boolean;
	filter: string;
	displayNamePrefix: string;
}): Promise<{
	persistedAssetId: string | null;
	r2Key: string;
	costUsd: number;
}> {
	const { app, req, r2Key, workspaceId, projectId, persistAsAsset, filter, displayNamePrefix } = opts;
	if (!app.r2) throw new Error("R2 not configured");

	// Pull source from R2 → tmpdir
	const workDir = join(tmpdir(), `magic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
	await mkdir(workDir, { recursive: true });
	try {
		const obj = await app.r2.send(
			new GetObjectCommand({ Bucket: app.r2Buckets.uploads, Key: r2Key }),
		);
		if (!obj.Body) throw new Error(`R2 ${r2Key} no body`);
		const chunks: Uint8Array[] = [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for await (const chunk of obj.Body as any) chunks.push(chunk as Uint8Array);
		const inputBuf = Buffer.concat(chunks);
		const inputPath = join(workDir, "in.mp4");
		const outputPath = join(workDir, "out.mp4");
		await writeFile(inputPath, inputBuf);

		await runFfmpeg([
			"-i", inputPath,
			"-vf", filter,
			"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
			"-c:a", "copy",
			"-y", outputPath,
		]);

		const outputBuf = await readFile(outputPath);
		req.log.info(
			{ inputSize: inputBuf.length, outputSize: outputBuf.length, filter },
			"ffmpeg magic filter complete",
		);

		if (persistAsAsset) {
			const saved = await saveAssetFromUrl({
				prisma: app.prisma,
				r2: app.r2,
				r2Bucket: app.r2Buckets.uploads,
				workspaceId,
				projectId,
				type: "VIDEO",
				sourceBuffer: outputBuf,
				mimeType: "video/mp4",
				source: "AI_GEN",
				displayName: `${displayNamePrefix} ${r2Key.split("/").pop() ?? ""}`,
				metadata: { filter, sourceR2Key: r2Key },
			});
			return {
				persistedAssetId: saved.assetId,
				r2Key: saved.r2Key,
				costUsd: 0, // CPU only — no Replicate
			};
		}

		// Save without Asset row → just R2 upload
		const directKey = `magic-tools/output/${workspaceId}/${Date.now()}-out.mp4`;
		const { PutObjectCommand } = await import("@aws-sdk/client-s3");
		await app.r2.send(
			new PutObjectCommand({
				Bucket: app.r2Buckets.uploads,
				Key: directKey,
				Body: outputBuf,
				ContentType: "video/mp4",
			}),
		);
		return { persistedAssetId: null, r2Key: directKey, costUsd: 0 };
	} finally {
		await rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}

export const magicToolsRoutes: FastifyPluginAsyncZod = async (app) => {
	// === Sprint 43: SAM 2 segment (background remove + object track) ===
	app.post("/segment", {
		schema: { body: SegmentBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			if (!(await checkProTier(app, req.body.workspaceId))) {
				reply.code(402);
				return { error: "Magic tools require Pro/Max tier" };
			}
			try {
				const result = await runSam2Segment(req.body.imageUrl, req.body.clickPoints);
				req.log.info(
					{ predictionId: result.predictionId, durationSec: result.durationSec },
					"SAM 2 segment complete",
				);
				return {
					combinedMaskUrl: result.output.combined_mask,
					individualMasks: result.output.individual_masks,
					predictionId: result.predictionId,
					costUsd: 0.05,
				};
			} catch (err) {
				req.log.error({ err }, "SAM 2 failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "Replicate error" };
			}
		},
	});

	// === Sprint 44: Real-ESRGAN upscale ===
	app.post("/upscale", {
		schema: { body: UpscaleBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			if (!(await checkProTier(app, req.body.workspaceId))) {
				reply.code(402);
				return { error: "Upscale requires Pro/Max tier" };
			}
			try {
				const result = await runRealEsrgan(req.body.imageUrl, req.body.scale);
				const cost = req.body.scale === 4 ? 0.16 : 0.04;
				req.log.info(
					{ predictionId: result.predictionId, scale: req.body.scale, costUsd: cost },
					"Real-ESRGAN upscale complete",
				);
				return {
					upscaledUrl: result.output,
					predictionId: result.predictionId,
					costUsd: cost,
					scale: req.body.scale,
				};
			} catch (err) {
				req.log.error({ err }, "Real-ESRGAN failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "Replicate error" };
			}
		},
	});

	// === S20 PW-24: Blur Video Background (FFmpeg boxblur) ===
	app.post("/blur-bg", {
		schema: { body: BlurBgBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			// Standard tier allowed (per SCOPE PW-24 — 1 shader, no GPU)
			try {
				const result = await ffmpegFilterRoute({
					app,
					req,
					r2Key: req.body.videoR2Key,
					workspaceId: req.body.workspaceId,
					projectId: req.body.projectId,
					persistAsAsset: req.body.persistAsAsset,
					filter: `boxblur=${req.body.blurRadius}:1`,
					displayNamePrefix: "Blur BG —",
				});
				return result;
			} catch (err) {
				req.log.error({ err: String(err) }, "blur-bg failed");
				reply.code(500);
				return { error: err instanceof Error ? err.message : "Filter failed" };
			}
		},
	});

	// === S20 PW-25: Video Stabilizer (FFmpeg deshake) ===
	app.post("/stabilize", {
		schema: { body: StabilizeBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			try {
				const result = await ffmpegFilterRoute({
					app,
					req,
					r2Key: req.body.videoR2Key,
					workspaceId: req.body.workspaceId,
					projectId: req.body.projectId,
					persistAsAsset: req.body.persistAsAsset,
					filter: `deshake=rx=${req.body.searchRange}:ry=${req.body.searchRange}`,
					displayNamePrefix: "Stabilized —",
				});
				return result;
			} catch (err) {
				req.log.error({ err: String(err) }, "stabilize failed");
				reply.code(500);
				return { error: err instanceof Error ? err.message : "Filter failed" };
			}
		},
	});

	// === Sprint 45: RIFE frame interpolation ===
	app.post("/interpolate", {
		schema: { body: InterpolateBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			if (!(await checkProTier(app, req.body.workspaceId))) {
				reply.code(402);
				return { error: "Smooth motion requires Pro/Max tier" };
			}
			try {
				const result = await runRifeInterpolation(req.body.videoUrl, req.body.multiplier);
				const cost = req.body.multiplier * 0.01;
				req.log.info(
					{ predictionId: result.predictionId, multiplier: req.body.multiplier, costUsd: cost },
					"RIFE interpolation complete",
				);
				return {
					interpolatedVideoUrl: result.output,
					predictionId: result.predictionId,
					costUsd: cost,
					multiplier: req.body.multiplier,
				};
			} catch (err) {
				req.log.error({ err }, "RIFE failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "Replicate error" };
			}
		},
	});
};
