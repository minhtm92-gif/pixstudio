/**
 * Magic tools API — Editor advanced features powered by Replicate (Phase 4).
 *
 *   POST /api/magic/segment    — SAM 2 background remove / object segment (Sprint 43)
 *   POST /api/magic/upscale    — Real-ESRGAN super-resolution (Sprint 44)
 *   POST /api/magic/interpolate — RIFE smooth motion (Sprint 45)
 *
 * All endpoints:
 *   - Auth required (workspace member)
 *   - Tier gate: PRO/MAX only (STANDARD blocked with 402)
 *   - Sync invocation — caller awaits Replicate response (1-15min depending on
 *     model). Returns Replicate output URL pointing at intermediate R2 storage.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";
import { runSam2Segment, runRealEsrgan, runRifeInterpolation } from "../services/replicate-client.js";

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
