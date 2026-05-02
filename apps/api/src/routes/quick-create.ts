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

function generateMockOutline(
	workflow: ReturnType<typeof workflowRegistry.get> & {},
	prompt: string,
) {
	if (!workflow) throw new Error("workflow required for mock outline");
	const sceneCount = workflow.platform.defaultDurationSec <= 30 ? 4 : 8;
	const sceneDuration = workflow.platform.defaultDurationSec / sceneCount;
	return {
		title: `[Mock] ${workflow.name}: ${prompt.slice(0, 60)}`,
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
		schema: {
			params: SessionIdParamsSchema,
			querystring: z.object({ live: z.coerce.boolean().optional() }),
		},
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

			const liveMode =
				req.query.live === true || process.env["QUICK_CREATE_OUTLINE_MODE"] === "live";

			let outline: {
				title: string;
				scenes: Array<{
					id: string;
					order: number;
					script: string;
					mediaQuery: string;
					durationSec: number;
				}>;
				suggestedChips: { audiences: string[]; lookFeel: string[]; platform: string };
			};
			let costUsd = 0;
			let durationMs = 0;

			if (liveMode && app.aiRouter) {
				// Real LLM call via DO Inference (priority channel for llm.chat).
				const sceneCount = workflow.platform.defaultDurationSec <= 30 ? 4 : 8;
				const totalSec = workflow.platform.defaultDurationSec;
				const language = workflow.defaultLanguage;
				const llmPrompt = `You are a video script outline generator for PixStudio (Vietnamese video platform).

User prompt: ${session.prompt}

Workflow: ${workflow.name} — ${workflow.description}
Default language: ${language}
Pace: ${workflow.pace}
Total duration: ${totalSec}s
Platform: ${workflow.platform.ratio} ratio

Generate exactly ${sceneCount} scenes that sum to ${totalSec}s ±5%.

Each scene must have:
- id (e.g. "scene-1")
- order (1-indexed integer)
- script (1-3 sentences in ${language === "vi" ? "Vietnamese" : "English"}, voice-friendly)
- mediaQuery (English keywords for stock search, e.g. "businessman office laptop")
- durationSec (number, scene length)

Also suggest:
- 1-3 audience chips (from set: senior-50plus-vn, genz-tiktok, young-parents, office-worker, ecom-seller)
- 1-2 look-feel chips (from set: cinematic, vlog, ad-style, documentary, kawaii)
- 1 platform chip (default ${workflow.platform.ratio === "9:16" ? "tiktok" : "youtube-long"})

Return JSON ONLY (no markdown fence) matching:
{"title": string, "scenes": [{"id","order","script","mediaQuery","durationSec"}], "suggestedChips": {"audiences": string[], "lookFeel": string[], "platform": string}}`;

				try {
					const startedAt = Date.now();
					const { result: llmResult } = await app.aiRouter.invoke(
						"llm.chat" as never,
						{
							prompt: llmPrompt,
							maxTokens: 1500,
							temperature: 0.7,
							responseFormat: "json_object",
						} as never,
						{ tier: "pro", workspaceId: session.workspaceId, userId: user.id } as never,
					);
					durationMs = Date.now() - startedAt;
					const text = (llmResult as { text?: string }).text ?? "";
					costUsd = (llmResult as { costUsd?: number }).costUsd ?? 0;

					// Parse JSON (LLM may return with leading/trailing whitespace or fences).
					const jsonStart = text.indexOf("{");
					const jsonEnd = text.lastIndexOf("}");
					if (jsonStart === -1 || jsonEnd === -1) {
						throw new Error("LLM did not return JSON object");
					}
					const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
					outline = {
						title: String(parsed.title ?? "Untitled"),
						scenes: Array.isArray(parsed.scenes)
							? parsed.scenes.map((s: Record<string, unknown>, i: number) => ({
									id: String(s["id"] ?? `scene-${i + 1}`),
									order: Number(s["order"] ?? i + 1),
									script: String(s["script"] ?? ""),
									mediaQuery: String(s["mediaQuery"] ?? ""),
									durationSec: Number(s["durationSec"] ?? totalSec / sceneCount),
								}))
							: [],
						suggestedChips: {
							audiences: Array.isArray(parsed.suggestedChips?.audiences)
								? parsed.suggestedChips.audiences.slice(0, 3).map(String)
								: ["genz-tiktok"],
							lookFeel: Array.isArray(parsed.suggestedChips?.lookFeel)
								? parsed.suggestedChips.lookFeel.slice(0, 2).map(String)
								: ["ad-style"],
							platform: String(
								parsed.suggestedChips?.platform ??
									(workflow.platform.ratio === "9:16" ? "tiktok" : "youtube-long"),
							),
						},
					};
				} catch (err) {
					req.log.error({ err }, "outline LLM call failed — falling back to mock");
					outline = generateMockOutline(workflow, session.prompt);
				}
			} else {
				outline = generateMockOutline(workflow, session.prompt);
			}

			const updated = (await app.prisma.quickCreateSession.update({
				where: { id: session.id },
				data: {
					outlineJson: outline as object,
					totalCostUsd: { increment: costUsd },
				},
			})) as SessionRow;

			return {
				outline,
				session: serializeSession(updated),
				meta: {
					mode: liveMode ? "live" : "mock",
					costUsd,
					durationMs,
				},
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
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const session = result.session;

			if (!session.outlineJson) {
				reply.status(400);
				return { error: "Outline not generated yet — call POST /outline first" };
			}
			if (!app.queues?.quickCreateBuild) {
				reply.status(503);
				return {
					error: "Queue not configured",
					message: "Set REDIS_URL to enable build pipeline",
				};
			}

			const job = await app.queues.quickCreateBuild.add("build", {
				sessionId: session.id,
				workspaceId: session.workspaceId,
				userId: session.userId,
			});

			await app.prisma.quickCreateSession.update({
				where: { id: session.id },
				data: { buildJobId: job.id, buildStatus: "PENDING" as never, buildProgress: 0 },
			});

			reply.code(202);
			return {
				sessionId: session.id,
				buildJobId: job.id,
				status: "PENDING",
				progress: 0,
				streamUrl: `/api/quick-create/sessions/${session.id}/build/stream`,
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
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const session = result.session;

			// Only allow cancel pre-stage 3 (per acceptance-criteria-draft.md)
			const cancelableStages = ["PENDING", "GENERATING_SCRIPT", "SYNTHESIZING_VOICE"];
			if (!cancelableStages.includes(session.buildStatus)) {
				reply.status(409);
				return {
					error: "Cannot cancel — build past matching-stock stage (cost incurred)",
					currentStatus: session.buildStatus,
				};
			}

			if (app.queues?.quickCreateBuild && session.buildJobId) {
				try {
					const job = await app.queues.quickCreateBuild.getJob(session.buildJobId);
					if (job) await job.remove();
				} catch (err) {
					req.log.warn({ err }, "BullMQ job remove failed");
				}
			}

			await app.prisma.quickCreateSession.update({
				where: { id: session.id },
				data: { buildStatus: "CANCELLED" as never, buildProgress: 0 },
			});

			return { sessionId: session.id, status: "CANCELLED" };
		},
	});

	// WebSocket: stream build events via polling DB session.buildStatus.
	// Sprint 3 polish: replace polling với BullMQ Pub/Sub events.
	app.get(
		"/sessions/:sessionId/build/stream",
		{ websocket: true, schema: { params: SessionIdParamsSchema } },
		async (socket, req) => {
			const session = await app.prisma.quickCreateSession.findUnique({
				where: { id: (req.params as { sessionId: string }).sessionId },
			});
			if (!session) {
				socket.send(JSON.stringify({ type: "error", message: "session not found" }));
				socket.close();
				return;
			}

			let lastStatus = "";
			let lastProgress = -1;
			const interval = setInterval(async () => {
				try {
					const fresh = await app.prisma.quickCreateSession.findUnique({
						where: { id: session.id },
					});
					if (!fresh) {
						socket.send(JSON.stringify({ type: "error", message: "session removed" }));
						socket.close();
						return;
					}
					if (fresh.buildStatus !== lastStatus || fresh.buildProgress !== lastProgress) {
						socket.send(
							JSON.stringify({
								type: "status-change",
								sessionId: fresh.id,
								status: fresh.buildStatus,
								progress: fresh.buildProgress,
							}),
						);
						lastStatus = fresh.buildStatus;
						lastProgress = fresh.buildProgress;
					}
					if (fresh.buildStatus === "COMPLETED" || fresh.buildStatus === "FAILED" || fresh.buildStatus === "CANCELLED") {
						socket.send(JSON.stringify({ type: "completed", sessionId: fresh.id, status: fresh.buildStatus }));
						clearInterval(interval);
						socket.close();
					}
				} catch (err) {
					req.log.error({ err }, "WS poll error");
				}
			}, 1000);

			socket.on("close", () => clearInterval(interval));
		},
	);

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
