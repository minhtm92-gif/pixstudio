/**
 * Admin GPU routes — Sprint 9 backend wire for /admin/gpu UI.
 *
 * ADMIN-only. Manual control DO L40S 48GB TOR1 droplet from snapshot.
 * Cost: ~$1.57/hr — always destroy after job. UI hard-cap warning at $10.
 *
 * Endpoints:
 * - GET    /api/admin/gpu/list      — list active droplets (tag=pixstudio)
 * - POST   /api/admin/gpu/spawn     — spawn from snapshot
 * - DELETE /api/admin/gpu/:id       — destroy specific droplet
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAdmin } from "../plugins/require-auth.js";
import {
	spawnGpuFromSnapshot,
	destroyGpu,
	listActiveGpuDroplets,
} from "../services/gpu-spawn.js";

export const adminGpuRoutes: FastifyPluginAsyncZod = async (app) => {
	// === GET /api/admin/gpu/list ===
	app.get("/gpu/list", {
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			try {
				const droplets = await listActiveGpuDroplets();
				return {
					droplets,
					totalActive: droplets.filter((d) => d.status === "active").length,
					snapshotId: process.env["PIXSTUDIO_GPU_SNAPSHOT_ID_TOR1"] ?? "226870948",
				};
			} catch (err) {
				req.log.error({ err }, "GPU list failed");
				reply.code(503);
				return {
					error: "DO API unreachable",
					message: err instanceof Error ? err.message : "Unknown DO error",
				};
			}
		},
	});

	// === POST /api/admin/gpu/spawn ===
	app.post("/gpu/spawn", {
		schema: {
			body: z.object({
				region: z.enum(["tor1", "nyc1", "ams3", "sfo3"]).default("tor1"),
				size: z.enum(["gpu-l40sx1-48gb", "gpu-rtx6000ada-48gb"]).default("gpu-l40sx1-48gb"),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			// Concurrency guard — refuse if already 1 active to prevent runaway cost.
			const active = await listActiveGpuDroplets();
			if (active.filter((d) => d.status === "active").length >= 1) {
				reply.code(409);
				return {
					error: "GPU already running",
					message: "Destroy active droplet trước khi spawn mới (cost guard).",
				};
			}

			try {
				const droplet = await spawnGpuFromSnapshot({
					region: req.body.region,
					size: req.body.size,
				});
				req.log.info({ dropletId: droplet.id, region: droplet.region }, "GPU spawned");
				reply.code(201);
				return { droplet };
			} catch (err) {
				req.log.error({ err }, "GPU spawn failed");
				reply.code(503);
				return {
					error: "Spawn failed",
					message: err instanceof Error ? err.message : "Unknown DO error",
				};
			}
		},
	});

	// === DELETE /api/admin/gpu/:id ===
	app.delete("/gpu/:id", {
		schema: {
			params: z.object({ id: z.coerce.number().int().positive() }),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			try {
				await destroyGpu(req.params.id);
				req.log.info({ dropletId: req.params.id }, "GPU destroyed");
				reply.code(204);
				return null;
			} catch (err) {
				req.log.error({ err }, "GPU destroy failed");
				reply.code(503);
				return {
					error: "Destroy failed",
					message: err instanceof Error ? err.message : "Unknown DO error",
				};
			}
		},
	});
};
