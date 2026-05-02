/**
 * Quick Create API routes — Phase 1 Sprint 2.
 *
 * Session lifecycle + outline generation (mock LLM until anh approves real spend).
 * Build pipeline + Path B reverse engineer remain stubs (Sprints 3-5).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { workflowRegistry } from "@pixstudio/quick-create";
import { requireUser } from "../plugins/require-auth.js";

const SessionIdParamsSchema = z.object({
	sessionId: z.string().uuid(),
});

const CreateSessionBodySchema = z.object({
	workspaceId: z.string().uuid(),
	prompt: z.string().max(25_000).default(""),
	mode: z.enum(["pathA", "pathB"]).default("pathA"),
});

const UpdateConfigBodySchema = z.object({
	workflowId: z.string().min(1),
	configOverrides: z.record(z.string(), z.unknown()).default({}),
});

const ChipSelectionsSchema = z.object({
	audiences: z.array(z.string()).max(3),
	lookFeel: z.array(z.string()).max(2),
	platform: z.string(),
});

interface SessionRow {
	id: string;
	userId: string;
	workspaceId: string;
	workflowId: string | null;
	prompt: string;
	mode: "PATH_A" | "PATH_B";
	configOverrides: unknown;
	outlineJson: unknown;
	chipSelectionsJson: unknown;
	buildStatus: string;
	buildProgress: number;
	createdAt: Date;
	updatedAt: Date;
}

const serializeSession = (s: SessionRow) => ({
	id: s.id,
	userId: s.userId,
	workspaceId: s.workspaceId,
	workflowId: s.workflowId,
	prompt: s.prompt,
	mode: s.mode,
	configOverrides: s.configOverrides,
	outlineJson: s.outlineJson,
	chipSelectionsJson: s.chipSelectionsJson,
	buildStatus: s.buildStatus,
	buildProgress: s.buildProgress,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString(),
});

export const quickCreateRoutes: FastifyPluginAsyncZod = async (app) => {
	type LoadSessionResult =
		| { error: "not_found"; session?: undefined }
		| { error: "forbidden"; session?: undefined }
		| { error?: undefined; session: SessionRow };

	async function loadSession(sessionId: string, userId: string): Promise<LoadSessionResult> {
		const session = (await app.prisma.quickCreateSession.findUnique({
			where: { id: sessionId },
		})) as SessionRow | null;
		if (!session) return { error: "not_found" };
		if (session.userId !== userId) return { error: "forbidden" };
		return { session };
	}

	function handleSessionError(reply: import("fastify").FastifyReply, kind: "not_found" | "forbidden") {
		reply.status(kind === "not_found" ? 404 : 403);
		return {
			error: kind === "not_found" ? "Session not found" : "Not your session",
		};
	}

	// ─── Session lifecycle ─────────────────────────────────────────

	app.post("/sessions", {
		schema: { body: CreateSessionBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const session = (await app.prisma.quickCreateSession.create({
				data: {
					userId: user.id,
					workspaceId: req.body.workspaceId,
					prompt: req.body.prompt,
					mode: req.body.mode === "pathA" ? "PATH_A" : "PATH_B",
				},
			})) as SessionRow;
			reply.status(201);
			return serializeSession(session);
		},
	});

	app.get("/sessions/:sessionId", {
		schema: { params: SessionIdParamsSchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			return serializeSession(result.session);
		},
	});

	app.patch("/sessions/:sessionId/config", {
		schema: {
			params: SessionIdParamsSchema,
			body: UpdateConfigBodySchema,
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const updated = (await app.prisma.quickCreateSession.update({
				where: { id: req.params.sessionId },
				data: {
					workflowId: req.body.workflowId,
					configOverrides: req.body.configOverrides as object,
				},
			})) as SessionRow;
			return serializeSession(updated);
		},
	});

	// ─── Outline generation (Sprint 2 wire-up) ─────────────────────

	app.post("/sessions/:sessionId/outline", {
		schema: { params: SessionIdParamsSchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const session = result.session;

			if (!session.workflowId) {
				reply.status(400);
				return { error: "Session has no workflowId — call /config first" };
			}
			const workflow = workflowRegistry.get(session.workflowId);
			if (!workflow) {
				reply.status(400);
				return { error: `Unknown workflow ${session.workflowId}` };
			}

			// Phase 1 Sprint 2: returning mock outline so UI can integrate without burning AI cost.
			// Real LLM wire-up: ai-mesh router invoke llm.chat with structured JSON schema response.
			const sceneCount = workflow.platform.defaultDurationSec <= 30 ? 4 : 8;
			const sceneDuration = workflow.platform.defaultDurationSec / sceneCount;
			const mockOutline = {
				title: `[Mock] ${workflow.name}: ${session.prompt.slice(0, 60)}`,
				scenes: Array.from({ length: sceneCount }, (_, i) => ({
					id: `scene-${i + 1}`,
					order: i + 1,
					script: `[Mock script scene ${i + 1}] ${workflow.samplePrompts[0] ?? "Sample text"}`,
					mediaQuery: "businessman office laptop modern",
					durationSec: Math.round(sceneDuration * 10) / 10,
				})),
				suggestedChips: {
					audiences: ["genz-tiktok"],
					lookFeel: ["ad-style"],
					platform: workflow.platform.ratio === "9:16" ? "tiktok" : "youtube-long",
				},
			};

			const updated = (await app.prisma.quickCreateSession.update({
				where: { id: session.id },
				data: { outlineJson: mockOutline as object },
			})) as SessionRow;

			return {
				outline: mockOutline,
				session: serializeSession(updated),
				_note:
					"Sprint 2: mock outline returned. Real LLM activation: env QUICK_CREATE_OUTLINE_MODE=live + ai-mesh router. Cost ~$0.01/outline DO Inference.",
			};
		},
	});

	app.patch("/sessions/:sessionId/chips", {
		schema: {
			params: SessionIdParamsSchema,
			body: ChipSelectionsSchema,
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const updated = (await app.prisma.quickCreateSession.update({
				where: { id: req.params.sessionId },
				data: { chipSelectionsJson: req.body as object },
			})) as SessionRow;
			return serializeSession(updated);
		},
	});

	// ─── Build pipeline (Sprint 2-3 stubs) ─────────────────────────

	app.post("/sessions/:sessionId/build", {
		schema: { params: SessionIdParamsSchema },
		handler: async (_req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "Build pipeline BullMQ wire-up Sprint 2 next iteration",
			};
		},
	});

	app.get("/sessions/:sessionId/build", {
		schema: { params: SessionIdParamsSchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			return {
				sessionId: result.session.id,
				status: result.session.buildStatus,
				progress: result.session.buildProgress,
			};
		},
	});

	app.delete("/sessions/:sessionId/build", {
		schema: { params: SessionIdParamsSchema },
		handler: async (_req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "Build cancel Sprint 2 next iteration",
			};
		},
	});

	// ─── Path B reverse engineer (Sprint 5) ─────────────────────────

	app.post("/sessions/:sessionId/reverse-engineer", {
		schema: { params: SessionIdParamsSchema },
		handler: async (_req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "Reverse engineer pipeline GPU spawn Sprint 5",
			};
		},
	});

	app.get("/sessions/:sessionId/reverse-engineer", {
		schema: { params: SessionIdParamsSchema },
		handler: async (_req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "Reverse engineer status Sprint 5",
			};
		},
	});

	// ─── Workflow + chip discovery ─────────────────────────────────

	app.get("/workflows", {
		schema: {
			querystring: z.object({
				tier: z.enum(["standard", "pro", "max"]).optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const tier = req.query.tier ?? "standard";
			const rank = { standard: 0, pro: 1, max: 2 };
			const items = workflowRegistry
				.listAvailableNow()
				.filter((t) => rank[t.requiredTier] <= rank[tier])
				.map((t) => ({
					id: t.id,
					name: t.name,
					nameEn: t.nameEn,
					description: t.description,
					thumbnail: t.thumbnail,
					pace: t.pace,
					defaultLanguage: t.defaultLanguage,
					ratio: t.platform.ratio,
					defaultDurationSec: t.platform.defaultDurationSec,
					requiredTier: t.requiredTier,
				}));
			return { items };
		},
	});

	app.get("/chips", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return {
				audiences: [],
				lookFeel: [],
				platforms: [],
				_note: "Sprint 2 next: wire chip registries from packages/quick-create",
			};
		},
	});
};
