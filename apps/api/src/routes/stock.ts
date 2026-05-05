/**
 * Stock library federated search — Sprint S19 (AS-V2 + AS-I2).
 *
 * SCOPE §4.3 + D17: federated search across admin pool 10-20 accounts of
 * iStock + Envato + Shutterstock. Round-robin quota-aware rotation. User
 * sees vendor badge only, never account_id.
 *
 * Phase S19 = SHELL endpoint. Real vendor SDK integration (iStock REST OAuth +
 * Envato API + Shutterstock API) deferred to S22+ when anh provides API
 * credentials via admin/stock UI. For now returns structured empty result so
 * frontend can wire up the search UI.
 *
 * Endpoints:
 *   POST /api/stock/search { query, type, aspectRatio?, durationSec?, limit }
 *     → { items: StockSearchHit[], pagination, vendors: { available, queryCount } }
 *   POST /api/stock/download { vendorAssetId, vendor, workspaceId, projectId? }
 *     → { assetId, r2Key, sizeBytes, mimeType }
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

interface StockSearchHit {
	vendorAssetId: string;
	vendor: "iStock" | "Envato" | "Shutterstock";
	type: "VIDEO" | "IMAGE" | "AUDIO";
	previewUrl: string;
	thumbnailUrl: string;
	durationSec: number | null;
	width: number | null;
	height: number | null;
	priceTier: "essential" | "premium" | "exclusive" | null;
	matchScore: number;
}

const SearchBodySchema = z.object({
	query: z.string().min(1).max(200),
	type: z.enum(["VIDEO", "IMAGE", "AUDIO"]).default("VIDEO"),
	aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
	durationSec: z.number().int().positive().optional(),
	limit: z.number().int().min(1).max(60).default(30),
	cursor: z.string().optional(),
});

const DownloadBodySchema = z.object({
	vendorAssetId: z.string(),
	vendor: z.enum(["iStock", "Envato", "Shutterstock"]),
	workspaceId: z.string().uuid(),
	projectId: z.string().uuid().optional(),
});

export const stockRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post("/search", {
		schema: { body: SearchBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			// Find active stock accounts (admin pool managed via /admin/stock UI).
			const activeAccounts = await app.prisma.stockAccount.findMany({
				where: { status: "ACTIVE" },
				select: {
					id: true,
					vendor: true,
					label: true,
					monthlyUsed: true,
					monthlyQuota: true,
				},
				orderBy: { monthlyUsed: "asc" },
			});

			// Group by vendor + filter exhausted quotas.
			const vendorAvailable: Record<string, boolean> = {};
			for (const acc of activeAccounts) {
				vendorAvailable[acc.vendor] =
					(vendorAvailable[acc.vendor] ?? false) ||
					acc.monthlyUsed < acc.monthlyQuota;
			}

			// SHELL: real vendor SDK call deferred S22+. Return structured empty
			// so frontend can wire up search UI without breaking.
			req.log.info(
				{
					userId: user.id,
					query: req.body.query,
					type: req.body.type,
					accountsActive: activeAccounts.length,
				},
				"stock search (shell — real vendor SDK S22+)",
			);

			const items: StockSearchHit[] = [];
			return {
				items,
				pagination: { cursor: null, hasMore: false, total: 0 },
				vendors: {
					iStock: { available: vendorAvailable.ISTOCK ?? false },
					Envato: { available: vendorAvailable.ENVATO ?? false },
					Shutterstock: { available: vendorAvailable.SHUTTERSTOCK ?? false },
				},
				message:
					activeAccounts.length === 0
						? "No active stock accounts. Anh add credentials via Settings → Admin → Stock Libraries first."
						: "Stock search shell — real vendor SDK integration is Sprint S22+ work.",
			};
		},
	});

	// POST /api/stock/download — vendor download wrapper (real impl S22+).
	app.post("/download", {
		schema: { body: DownloadBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			req.log.info(
				{
					userId: user.id,
					vendor: req.body.vendor,
					vendorAssetId: req.body.vendorAssetId,
				},
				"stock download requested (shell — real vendor SDK S22+)",
			);
			reply.code(501);
			return {
				error: "Stock vendor download not implemented",
				message: "Real iStock/Envato/Shutterstock SDK integration is Sprint S22+ work. Currently returning 501 so frontend can show 'Phase 2 ships full' placeholder.",
			};
		},
	});
};
