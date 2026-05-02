/**
 * Brand Kit routes — Sprint 3 Story 3.1.
 *
 * Per-workspace brand customization (Pro+ tier). Tier gate via Workspace.billingTier.
 * Logo + favicon uploaded via presigned R2 URL (reuse pattern from assets.ts).
 *
 * Endpoints:
 * - GET    /api/workspaces/:workspaceId/brand-kit       — fetch (any member)
 * - PUT    /api/workspaces/:workspaceId/brand-kit       — upsert (OWNER only, Pro+ tier)
 * - POST   /api/workspaces/:workspaceId/brand-kit/logo-presign — request R2 PUT URL for logo
 * - DELETE /api/workspaces/:workspaceId/brand-kit       — clear (OWNER only)
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be hex #RRGGBB");

const BrandKitSchema = z.object({
	id: z.string(),
	workspaceId: z.string(),
	logoR2Key: z.string().nullable(),
	faviconR2Key: z.string().nullable(),
	primaryColor: HexColorSchema,
	secondaryColor: HexColorSchema.nullable(),
	accentColor: HexColorSchema.nullable(),
	fontFamily: z.string().nullable(),
	watermarkText: z.string().nullable(),
	watermarkOn: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const UpsertBodySchema = z.object({
	primaryColor: HexColorSchema.optional(),
	secondaryColor: HexColorSchema.nullable().optional(),
	accentColor: HexColorSchema.nullable().optional(),
	fontFamily: z.string().max(64).nullable().optional(),
	watermarkText: z.string().max(50).nullable().optional(),
	watermarkOn: z.boolean().optional(),
	logoR2Key: z.string().nullable().optional(),
	faviconR2Key: z.string().nullable().optional(),
});

const PresignBodySchema = z.object({
	kind: z.enum(["logo", "favicon"]),
	mimeType: z.enum(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]),
	sizeBytes: z
		.number()
		.int()
		.positive()
		.max(5 * 1024 * 1024), // 5MB cap for brand assets
});

interface BrandKitRow {
	id: string;
	workspaceId: string;
	logoR2Key: string | null;
	faviconR2Key: string | null;
	primaryColor: string;
	secondaryColor: string | null;
	accentColor: string | null;
	fontFamily: string | null;
	watermarkText: string | null;
	watermarkOn: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const serialize = (b: BrandKitRow) => ({
	...b,
	createdAt: b.createdAt.toISOString(),
	updatedAt: b.updatedAt.toISOString(),
});

export const brandKitRoutes: FastifyPluginAsyncZod = async (app) => {
	// Tier gate — Brand Kit is Pro+ feature.
	async function requireProTier(workspaceId: string): Promise<boolean> {
		const ws = await app.prisma.workspace.findUnique({
			where: { id: workspaceId },
			select: { billingTier: true },
		});
		if (!ws) return false;
		return ws.billingTier === "PRO" || ws.billingTier === "MAX";
	}

	// === GET /api/workspaces/:workspaceId/brand-kit ===
	app.get("/:workspaceId/brand-kit", {
		schema: {
			params: z.object({ workspaceId: z.string().uuid() }),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const member = await requireWorkspaceMember(app, req.params.workspaceId, user.id, "VIEWER");
			if (!member) {
				reply.code(403);
				return { error: "Not a member of this workspace" };
			}

			const kit = (await app.prisma.brandKit.findUnique({
				where: { workspaceId: req.params.workspaceId },
			})) as BrandKitRow | null;

			if (!kit) {
				// Return defaults — UI can still render w/ defaults before kit is upserted
				return {
					brandKit: null,
					defaults: {
						primaryColor: "#3B82F6",
						fontFamily: "Inter",
						watermarkText: null,
						watermarkOn: true,
					},
				};
			}

			return { brandKit: serialize(kit), defaults: null };
		},
	});

	// === PUT /api/workspaces/:workspaceId/brand-kit (upsert) ===
	app.put("/:workspaceId/brand-kit", {
		schema: {
			params: z.object({ workspaceId: z.string().uuid() }),
			body: UpsertBodySchema,
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const member = await requireWorkspaceMember(app, req.params.workspaceId, user.id, "OWNER");
			if (!member) {
				reply.code(403);
				return { error: "Only workspace OWNER can edit brand kit" };
			}

			const isPro = await requireProTier(req.params.workspaceId);
			if (!isPro) {
				reply.code(402);
				return {
					error: "Brand Kit requires Pro tier",
					message: "Upgrade workspace to Pro or Max to enable brand customization",
				};
			}

			const updated = (await app.prisma.brandKit.upsert({
				where: { workspaceId: req.params.workspaceId },
				create: {
					workspaceId: req.params.workspaceId,
					...req.body,
				},
				update: req.body,
			})) as BrandKitRow;

			return { brandKit: serialize(updated) };
		},
	});

	// === POST /api/workspaces/:workspaceId/brand-kit/logo-presign ===
	app.post("/:workspaceId/brand-kit/logo-presign", {
		schema: {
			params: z.object({ workspaceId: z.string().uuid() }),
			body: PresignBodySchema,
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const member = await requireWorkspaceMember(app, req.params.workspaceId, user.id, "OWNER");
			if (!member) {
				reply.code(403);
				return { error: "Only workspace OWNER can upload brand assets" };
			}

			const isPro = await requireProTier(req.params.workspaceId);
			if (!isPro) {
				reply.code(402);
				return { error: "Brand Kit requires Pro tier" };
			}

			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}

			const ext = {
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/svg+xml": "svg",
				"image/webp": "webp",
			}[req.body.mimeType];
			const r2Key = `brand-kit/${req.params.workspaceId}/${req.body.kind}-${Date.now()}.${ext}`;

			const command = new PutObjectCommand({
				Bucket: app.r2Buckets.uploads,
				Key: r2Key,
				ContentType: req.body.mimeType,
				ContentLength: req.body.sizeBytes,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const presignedUrl = await getSignedUrl(app.r2 as any, command as any, {
				expiresIn: 600, // 10 min
			});

			return {
				presignedUrl,
				r2Key,
				expiresInSec: 600,
			};
		},
	});

	// === DELETE /api/workspaces/:workspaceId/brand-kit ===
	app.delete("/:workspaceId/brand-kit", {
		schema: {
			params: z.object({ workspaceId: z.string().uuid() }),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const member = await requireWorkspaceMember(app, req.params.workspaceId, user.id, "OWNER");
			if (!member) {
				reply.code(403);
				return { error: "Only workspace OWNER can delete brand kit" };
			}

			await app.prisma.brandKit.deleteMany({
				where: { workspaceId: req.params.workspaceId },
			});

			return { success: true };
		},
	});
};
