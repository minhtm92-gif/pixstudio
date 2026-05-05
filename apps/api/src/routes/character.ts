/**
 * Character routes — Sprint S31 (PW-20 + AS-C3).
 *
 *   GET  /api/character/sources       — list character generation modes
 *   POST /api/character/seedream      — Seedream avatar (non-real-human, Pro tier)
 *   POST /api/character/dreamactor    — DreamActor real-human clone (Max tier, no watermark D31)
 *   POST /api/character/upload-ref    — User uploads reference photos for AS-C1
 *
 * Per SCOPE PW-20 + AS-C3 + D31. Seedream wired via Byteplus client (S18
 * already has HMAC). DreamActor requires anh contract Byteplus DreamActor
 * API access — currently 501.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

interface CharacterSource {
	id: "seedream" | "dream-actor";
	displayName: string;
	tier: "pro" | "max";
	configured: boolean;
	requiredEnvVars: string[];
	description: string;
}

const CHARACTER_SOURCES: CharacterSource[] = [
	{
		id: "seedream",
		displayName: "Seedream avatar",
		tier: "pro",
		configured:
			!!process.env["BYTEPLUS_ACCESS_KEY"] && !!process.env["BYTEPLUS_SECRET_KEY"],
		requiredEnvVars: ["BYTEPLUS_ACCESS_KEY", "BYTEPLUS_SECRET_KEY"],
		description:
			"Generate non-real-human avatar character. Lightweight Pro tier feature with photo + style prompt.",
	},
	{
		id: "dream-actor",
		displayName: "DreamActor real-human clone",
		tier: "max",
		configured:
			!!process.env["DREAMACTOR_API_KEY"] || !!process.env["BYTEPLUS_DREAMACTOR_TOKEN"],
		requiredEnvVars: ["DREAMACTOR_API_KEY"],
		description:
			"Per SCOPE D31: NO watermark applied. Real-human character clone — requires consent form + abuse log per Risk #5 mitigation.",
	},
];

export const characterRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/sources", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { items: CHARACTER_SOURCES };
		},
	});

	app.post("/seedream", {
		schema: {
			body: z.object({
				workspaceId: z.string().uuid(),
				prompt: z.string().min(1).max(800),
				referenceImageUrl: z.string().url().optional(),
				gender: z.enum(["female", "male", "neutral"]).default("female"),
				ageGroup: z.enum(["child", "teen", "young", "middle-aged", "senior"]).default("young"),
				style: z.string().optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role" };
			}
			// Check Pro tier
			const ws = await app.prisma.workspace.findUnique({
				where: { id: req.body.workspaceId },
				select: { billingTier: true },
			});
			if (ws?.billingTier === "STANDARD") {
				reply.code(402);
				return { error: "Seedream avatar requires Pro/Max tier" };
			}
			reply.code(501);
			return {
				error: "Seedream character endpoint not implemented",
				message: "Byteplus client supports Seedance video gen (S18). Seedream image avatar uses different endpoint — implementation deferred S32+ alongside ComfyUI stylization once GPU droplet provisioned.",
			};
		},
	});

	app.post("/dreamactor", {
		schema: {
			body: z.object({
				workspaceId: z.string().uuid(),
				/** Consent form acknowledgment — required per Risk #5 mitigation. */
				consentAccepted: z.boolean(),
				/** Real-human reference photo URLs (3-10 photos required for clone). */
				referencePhotoUrls: z.array(z.string().url()).min(3).max(10),
				name: z.string().min(2).max(100),
				notes: z.string().optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id, "OWNER");
			if (!member) {
				reply.code(403);
				return { error: "Only workspace OWNER can train DreamActor characters" };
			}
			const ws = await app.prisma.workspace.findUnique({
				where: { id: req.body.workspaceId },
				select: { billingTier: true },
			});
			if (ws?.billingTier !== "MAX") {
				reply.code(402);
				return { error: "DreamActor real-human clone requires Max tier" };
			}
			if (!req.body.consentAccepted) {
				reply.code(400);
				return {
					error: "Consent form required",
					message: "Per SCOPE Risk #5 + D31: real-human clone requires explicit consent form acknowledgment.",
				};
			}
			const source = CHARACTER_SOURCES.find((s) => s.id === "dream-actor");
			if (!source?.configured) {
				reply.code(503);
				return {
					error: "DreamActor not configured",
					message: `Anh need to set ${source?.requiredEnvVars.join(" / ")} on Fly. Contract DreamActor API access via Byteplus partner contract (per memory pixstudio_phase2_autonomous_decision_2026_05_05.md).`,
				};
			}
			// Audit log per Risk #5 — abuse mitigation
			req.log.info(
				{
					userId: user.id,
					workspaceId: req.body.workspaceId,
					name: req.body.name,
					photoCount: req.body.referencePhotoUrls.length,
				},
				"DreamActor character submission — abuse audit log",
			);
			reply.code(501);
			return {
				error: "DreamActor flow not wired",
				message: "Endpoint reached but training submission is S32+ work pending DreamActor API contract.",
			};
		},
	});
};
