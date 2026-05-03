/**
 * Admin Stock Library routes — Sprint 5 Story 4.1.
 *
 * ADMIN-ONLY (User.systemRole === ADMIN). anh manages 10-20 accounts iStock +
 * Envato + Shutterstock. Credentials stored encrypted in R2 (admin-only access),
 * referenced by R2 key in DB.
 *
 * Endpoints:
 * - GET    /api/admin/stock-accounts             — list all
 * - POST   /api/admin/stock-accounts             — register new account
 * - PATCH  /api/admin/stock-accounts/:id         — update quota/status
 * - DELETE /api/admin/stock-accounts/:id         — disable + remove
 * - GET    /api/admin/stock-accounts/:id/usage   — month-to-date downloads
 * - GET    /api/admin/stock-downloads            — global feed (audit trail)
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAdmin } from "../plugins/require-auth.js";

const StockVendorSchema = z.enum(["ISTOCK", "ENVATO", "SHUTTERSTOCK"]);
const StockAccountStatusSchema = z.enum(["ACTIVE", "RATE_LIMITED", "EXPIRED", "DISABLED"]);

const CreateAccountBodySchema = z.object({
	vendor: StockVendorSchema,
	label: z.string().min(1).max(80),
	apiCredentialsKey: z.string(), // R2 key (admin uploads encrypted JSON via separate flow)
	monthlyQuota: z.number().int().positive().max(100_000),
	resetDayOfMonth: z.number().int().min(1).max(28).default(1),
});

const UpdateAccountBodySchema = z.object({
	label: z.string().min(1).max(80).optional(),
	monthlyQuota: z.number().int().positive().max(100_000).optional(),
	resetDayOfMonth: z.number().int().min(1).max(28).optional(),
	status: StockAccountStatusSchema.optional(),
});

export const adminStockRoutes: FastifyPluginAsyncZod = async (app) => {
	// === GET /stock-accounts ===
	app.get("/stock-accounts", {
		schema: {
			querystring: z.object({
				vendor: StockVendorSchema.optional(),
				status: StockAccountStatusSchema.optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const where: Record<string, unknown> = {};
			if (req.query.vendor) where["vendor"] = req.query.vendor;
			if (req.query.status) where["status"] = req.query.status;
			const accounts = await app.prisma.stockAccount.findMany({
				where,
				orderBy: [{ vendor: "asc" }, { createdAt: "asc" }],
			});
			return {
				items: accounts.map((a) => ({
					id: a.id,
					vendor: a.vendor,
					label: a.label,
					monthlyQuota: a.monthlyQuota,
					monthlyUsed: a.monthlyUsed,
					resetDayOfMonth: a.resetDayOfMonth,
					status: a.status,
					utilizationPct: a.monthlyQuota > 0
						? Math.round((a.monthlyUsed / a.monthlyQuota) * 100)
						: 0,
					createdAt: a.createdAt.toISOString(),
				})),
			};
		},
	});

	// === POST /stock-accounts (create new) ===
	app.post("/stock-accounts", {
		schema: { body: CreateAccountBodySchema },
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const account = await app.prisma.stockAccount.create({
				data: req.body,
			});
			reply.code(201);
			return {
				id: account.id,
				vendor: account.vendor,
				label: account.label,
				monthlyQuota: account.monthlyQuota,
				status: account.status,
			};
		},
	});

	// === PATCH /stock-accounts/:id ===
	app.patch("/stock-accounts/:id", {
		schema: {
			params: z.object({ id: z.string().uuid() }),
			body: UpdateAccountBodySchema,
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const updated = await app.prisma.stockAccount.update({
				where: { id: req.params.id },
				data: req.body,
			});
			return {
				id: updated.id,
				vendor: updated.vendor,
				label: updated.label,
				monthlyQuota: updated.monthlyQuota,
				status: updated.status,
			};
		},
	});

	// === DELETE /stock-accounts/:id ===
	app.delete("/stock-accounts/:id", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			// Soft-delete via status DISABLED; preserve history for audit.
			await app.prisma.stockAccount.update({
				where: { id: req.params.id },
				data: { status: "DISABLED" },
			});
			return { success: true, status: "DISABLED" };
		},
	});

	// === GET /stock-accounts/:id/usage ===
	app.get("/stock-accounts/:id/usage", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const account = await app.prisma.stockAccount.findUnique({
				where: { id: req.params.id },
			});
			if (!account) {
				reply.code(404);
				return { error: "Account not found" };
			}
			// Month-to-date: from 1st of current month
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const downloads = await app.prisma.stockDownload.findMany({
				where: {
					accountId: req.params.id,
					createdAt: { gte: monthStart },
				},
				orderBy: { createdAt: "desc" },
				take: 100,
			});
			return {
				account: {
					id: account.id,
					vendor: account.vendor,
					label: account.label,
					monthlyQuota: account.monthlyQuota,
					monthlyUsed: account.monthlyUsed,
				},
				downloadsThisMonth: downloads.length,
				totalCostCents: downloads.reduce((sum, d) => sum + d.costCents, 0),
				items: downloads.slice(0, 50).map((d) => ({
					id: d.id,
					vendorAssetId: d.vendorAssetId,
					workspaceId: d.workspaceId,
					projectId: d.projectId,
					costCents: d.costCents,
					createdAt: d.createdAt.toISOString(),
				})),
			};
		},
	});

	// === GET /stock-downloads (global audit feed) ===
	app.get("/stock-downloads", {
		schema: {
			querystring: z.object({
				limit: z.coerce.number().int().min(1).max(500).default(50),
				workspaceId: z.string().uuid().optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;
			const where: Record<string, unknown> = {};
			if (req.query.workspaceId) where["workspaceId"] = req.query.workspaceId;
			const items = await app.prisma.stockDownload.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: req.query.limit,
				include: {
					account: { select: { vendor: true, label: true } },
				},
			});
			return {
				items: items.map((d) => ({
					id: d.id,
					vendor: d.account.vendor,
					accountLabel: d.account.label,
					vendorAssetId: d.vendorAssetId,
					workspaceId: d.workspaceId,
					userId: d.userId,
					projectId: d.projectId,
					costCents: d.costCents,
					createdAt: d.createdAt.toISOString(),
				})),
			};
		},
	});
};
