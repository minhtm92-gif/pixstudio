/**
 * Quick Create API routes — Phase 1 Sprint 1 stubs.
 *
 * All endpoints return 501 Not Implemented for now. Sprint 1 wires Hero+WorkflowPicker+Config,
 * Sprint 2 adds outline + build BullMQ worker.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const SessionIdParamsSchema = z.object({
	sessionId: z.string().uuid(),
});

const CreateSessionBodySchema = z.object({
	workspaceId: z.string().uuid(),
	prompt: z.string().max(25_000).default(""),
	mode: z.enum(["pathA", "pathB"]).default("pathA"),
});

const UpdateConfigBodySchema = z.object({
	workflowId: z.string(),
	configOverrides: z.record(z.unknown()).default({}),
});

const ChipSelectionsSchema = z.object({
	audiences: z.array(z.string()).max(3),
	lookFeel: z.array(z.string()).max(2),
	platform: z.string(),
});

export const quickCreateRoutes: FastifyPluginAsync = async (app) => {
	// ─── Session lifecycle ─────────────────────────────────────────

	app.post(
		"/sessions",
		{ schema: { body: CreateSessionBodySchema } },
		async (req, reply) => {
			// TODO Sprint 1:
			// 1. authn check (better-auth getSession)
			// 2. workspace member check
			// 3. tier quota check (quick-create projects/month)
			// 4. create QuickCreateSession DB row
			// 5. return session
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "POST /api/quick-create/sessions stub - Sprint 1 wire-up pending",
			};
		}
	);

	app.get(
		"/sessions/:sessionId",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "GET /api/quick-create/sessions/:sessionId stub",
			};
		}
	);

	app.patch(
		"/sessions/:sessionId/config",
		{
			schema: {
				params: SessionIdParamsSchema,
				body: UpdateConfigBodySchema,
			},
		},
		async (req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "PATCH /api/quick-create/sessions/:sessionId/config stub",
			};
		}
	);

	// ─── Outline generation (Sprint 2) ─────────────────────────────

	app.post(
		"/sessions/:sessionId/outline",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			// TODO Sprint 2: invoke OutlineService
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "POST /api/quick-create/sessions/:sessionId/outline stub - Sprint 2 wire-up",
			};
		}
	);

	app.patch(
		"/sessions/:sessionId/chips",
		{
			schema: {
				params: SessionIdParamsSchema,
				body: ChipSelectionsSchema,
			},
		},
		async (req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "PATCH /api/quick-create/sessions/:sessionId/chips stub",
			};
		}
	);

	// ─── Build pipeline (Sprint 2-3) ───────────────────────────────

	app.post(
		"/sessions/:sessionId/build",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			// TODO Sprint 2: enqueue BullMQ job
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "POST /api/quick-create/sessions/:sessionId/build stub - Sprint 2 wire-up",
			};
		}
	);

	app.get(
		"/sessions/:sessionId/build",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "GET /api/quick-create/sessions/:sessionId/build stub - poll status",
			};
		}
	);

	app.delete(
		"/sessions/:sessionId/build",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			// Cancel build (only allowed pre-stage 3)
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "DELETE /api/quick-create/sessions/:sessionId/build stub - Sprint 2",
			};
		}
	);

	// WebSocket for live progress (Sprint 2)
	app.get("/sessions/:sessionId/build/stream", { websocket: true }, (connection, req) => {
		// TODO Sprint 2: subscribe to BullMQ events for sessionId, push to WS client
		connection.socket.send(
			JSON.stringify({
				type: "error",
				message: "Build event stream not yet implemented (Phase 1 Sprint 2)",
			})
		);
		connection.socket.close();
	});

	// ─── Path B reverse engineer (Sprint 5) ─────────────────────────

	app.post(
		"/sessions/:sessionId/reverse-engineer",
		{
			schema: {
				params: SessionIdParamsSchema,
				body: z.discriminatedUnion("type", [
					z.object({ type: z.literal("upload"), assetId: z.string().uuid() }),
					z.object({ type: z.literal("url"), url: z.string().url() }),
				]),
			},
		},
		async (req, reply) => {
			// TODO Sprint 5: enqueue ReverseEngineerService job
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "POST /api/quick-create/sessions/:sessionId/reverse-engineer stub - Sprint 5",
			};
		}
	);

	app.get(
		"/sessions/:sessionId/reverse-engineer",
		{ schema: { params: SessionIdParamsSchema } },
		async (req, reply) => {
			reply.code(501);
			return {
				error: "Not Implemented",
				message: "GET /api/quick-create/sessions/:sessionId/reverse-engineer stub - poll",
			};
		}
	);

	// ─── Workflow + chip discovery (Sprint 1) ──────────────────────

	app.get("/workflows", async (req, reply) => {
		// TODO Sprint 1: query workflowRegistry.listAvailableNow() filtered by user tier
		reply.code(501);
		return {
			error: "Not Implemented",
			message: "GET /api/quick-create/workflows stub - Sprint 1",
		};
	});

	app.get("/chips", async (req, reply) => {
		// Return all active chips grouped by category
		reply.code(501);
		return {
			error: "Not Implemented",
			message: "GET /api/quick-create/chips stub - Sprint 1",
		};
	});
};
