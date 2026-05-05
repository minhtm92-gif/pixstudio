/**
 * Templates routes — Sprint S22 (T-2 SCOPE §4.5).
 *
 * Browse + clone-from-template. Templates are seeded from
 * apps/api/src/data/template-seed.ts (50 hand-curated patterns from Crossian
 * RAG sanitized + cultural VN bundles).
 *
 *   GET  /api/templates                — list with category filter
 *   GET  /api/templates/:id            — single
 *   POST /api/templates/:id/clone      — create new Quick Create session
 *                                         pre-filled with template outline
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";
import { TEMPLATE_SEED, findTemplateSeed } from "../data/template-seed.js";

export const templatesRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/", {
		schema: {
			querystring: z.object({
				category: z
					.enum(["product-ad", "ugc-review", "tutorial", "trending", "seasonal", "entertainment"])
					.optional(),
				platform: z
					.enum(["tiktok", "fb-feed", "fb-ad-vertical", "youtube-long", "youtube-shorts", "ig-reels"])
					.optional(),
				workflowId: z.string().optional(),
				limit: z.coerce.number().int().min(1).max(100).default(50),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			let items = TEMPLATE_SEED;
			if (req.query.category) items = items.filter((t) => t.category === req.query.category);
			if (req.query.platform) items = items.filter((t) => t.platform === req.query.platform);
			if (req.query.workflowId) items = items.filter((t) => t.workflowId === req.query.workflowId);
			return {
				items: items.slice(0, req.query.limit),
				total: items.length,
				totalSeed: TEMPLATE_SEED.length,
			};
		},
	});

	app.get("/:id", {
		schema: { params: z.object({ id: z.string() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const template = findTemplateSeed(req.params.id);
			if (!template) {
				reply.code(404);
				return { error: "Template not found" };
			}
			return template;
		},
	});

	app.post("/:id/clone", {
		schema: {
			params: z.object({ id: z.string() }),
			body: z.object({ workspaceId: z.string().uuid() }),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const template = findTemplateSeed(req.params.id);
			if (!template) {
				reply.code(404);
				return { error: "Template not found" };
			}

			// Create new Quick Create session with template-seeded outline
			const session = await app.prisma.quickCreateSession.create({
				data: {
					userId: user.id,
					workspaceId: req.body.workspaceId,
					workflowId: template.workflowId,
					prompt: `From template "${template.name}": ${template.preview.hookLine}`,
					mode: "PATH_A",
					outlineJson: {
						title: template.name,
						scenes: template.preview.structure.map((stage, i) => ({
							id: `scene-${i + 1}`,
							order: i + 1,
							script: stage,
							mediaQuery: stage.toLowerCase(),
							durationSec: Math.round(template.durationSec / template.preview.structure.length),
						})),
						suggestedChips: {
							audiences: template.suggestedChips.audiences,
							lookFeel: template.suggestedChips.lookFeel,
							platform: template.platform,
						},
						templateId: template.id,
						templateCtaLine: template.preview.ctaLine,
					} as never,
				},
				select: { id: true, workflowId: true },
			});

			req.log.info(
				{ userId: user.id, templateId: template.id, sessionId: session.id },
				"template cloned to Quick Create session",
			);

			return {
				sessionId: session.id,
				workflowId: session.workflowId,
				editorUrl: `/quick-create/workflows/${session.workflowId}/outline?sessionId=${session.id}`,
				templateId: template.id,
			};
		},
	});
};
