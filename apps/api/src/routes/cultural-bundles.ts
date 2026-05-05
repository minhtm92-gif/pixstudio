/**
 * Cultural bundles routes — Sprint S32 (T-3).
 *
 *   GET /api/cultural-bundles                  — list all bundles
 *   GET /api/cultural-bundles/active           — currently active by month
 *   GET /api/cultural-bundles/:id              — detail
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";
import {
	CULTURAL_BUNDLES,
	findCulturalBundle,
	getActiveBundlesForMonth,
} from "../data/cultural-bundles.js";

export const culturalBundlesRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/", {
		schema: {
			querystring: z.object({
				holiday: z.enum(["tet", "trungthu", "quockhanh", "blackfriday"]).optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			let items = CULTURAL_BUNDLES;
			if (req.query.holiday) items = items.filter((b) => b.holiday === req.query.holiday);
			return { items };
		},
	});

	app.get("/active", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const month = new Date().getMonth() + 1;
			const items = getActiveBundlesForMonth(month);
			return { items, currentMonth: month };
		},
	});

	app.get("/:id", {
		schema: { params: z.object({ id: z.string() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const bundle = findCulturalBundle(req.params.id);
			if (!bundle) {
				reply.code(404);
				return { error: "Cultural bundle not found" };
			}
			return bundle;
		},
	});
};
