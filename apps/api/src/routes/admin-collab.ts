/**
 * Admin collab routes — Sprint S25.
 *
 *   POST /api/admin/collab/chaos-fuzz — run Yjs chaos fuzzer
 *
 * Per SCOPE D26: must run 1000-iter chaos fuzz before partner beta launch
 * to validate collab convergence. Admin-only.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAdmin } from "../plugins/require-auth.js";
import { runChaosFuzz } from "../services/collab-chaos-fuzzer.js";

export const adminCollabRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post("/collab/chaos-fuzz", {
		schema: {
			body: z.object({
				iterations: z.number().int().min(10).max(10000).default(1000),
				clientCount: z.number().int().min(2).max(20).default(5),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			req.log.info(
				{ iterations: req.body.iterations, clientCount: req.body.clientCount },
				"chaos fuzz starting",
			);
			const report = runChaosFuzz({
				iterations: req.body.iterations,
				clientCount: req.body.clientCount,
			});
			req.log.info(
				{
					convergent: report.convergent,
					iterations: report.iterations,
					durationMs: report.durationMs,
					opCounts: report.opCounts,
				},
				"chaos fuzz complete",
			);
			return report;
		},
	});
};
