/**
 * Quick Create API routes — Phase 1 Sprint 2.
 *
 * Session lifecycle + outline generation (mock LLM until anh approves real spend).
 * Build pipeline + Path B reverse engineer remain stubs (Sprints 3-5).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { workflowRegistry, isCrossianRagEligible } from "@pixstudio/quick-create";
import type { Language } from "@pixstudio/quick-create";
import { requireUser } from "../plugins/require-auth.js";
import { runPathBPipeline, JobCancelledError } from "../services/path-b-pipeline.js";
import {
	buildPathBEditorState,
	secondsToQuotaMinutes,
} from "../services/path-b-editor-state.js";
import { checkPathBQuota, incrementPathBMinutes } from "../services/tier-quota.js";

const SessionIdParamsSchema = z.object({
	sessionId: z.string().uuid(),
});

const VIDEO_URL_PATTERN =
	/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?|youtu\.be\/|tiktok\.com\/|instagram\.com\/(?:reel|p)\/|vimeo\.com\/)/i;

const CreateSessionBodySchema = z
	.object({
		workspaceId: z.string().uuid(),
		prompt: z.string().max(25_000).default(""),
		mode: z.enum(["pathA", "pathB"]).default("pathA"),
		/** Required when mode=pathB. YouTube / TikTok / Reel / Vimeo URL. */
		pathBVideoUrl: z
			.string()
			.regex(VIDEO_URL_PATTERN, "URL must be YouTube / TikTok / Instagram Reel / Vimeo")
			.optional(),
		/** Hero "+ button" attachments (QC-4) — R2 keys uploaded via /hero-attachments/presign. */
		heroAttachmentR2Keys: z.array(z.string()).max(5).optional(),
	})
	.refine(
		(body) => body.mode !== "pathB" || (body.pathBVideoUrl && body.pathBVideoUrl.length > 0),
		{ message: "pathBVideoUrl required when mode=pathB", path: ["pathBVideoUrl"] },
	);

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
	buildJobId: string | null;
	buildStatus: string;
	buildProgress: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Parse outline LLM response — handles raw JSON, markdown ```json fences,
 * and content with leading/trailing whitespace or commentary text. Returns
 * `null` if no valid JSON object detected (caller should fall back to mock).
 */
function parseOutlineLLMResponse(rawText: string): Record<string, unknown> | null {
	if (!rawText) return null;
	// Strip markdown fence (```json ... ``` or ``` ... ```)
	let text = rawText.trim();
	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fenceMatch?.[1]) {
		text = fenceMatch[1].trim();
	}
	// Find first { ... last } substring (handle commentary before/after JSON)
	const jsonStart = text.indexOf("{");
	const jsonEnd = text.lastIndexOf("}");
	if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
		return null;
	}
	const slice = text.slice(jsonStart, jsonEnd + 1);
	try {
		return JSON.parse(slice) as Record<string, unknown>;
	} catch {
		return null;
	}
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

	// Codex P1 #1: prevent cross-tenant session creation by enforcing workspace membership.
	async function ensureWorkspaceMember(workspaceId: string, userId: string) {
		return app.prisma.workspaceMember.findUnique({
			where: { workspaceId_userId: { workspaceId, userId } },
		});
	}

	// ─── Hero attachments (QC-4) ───────────────────────────────────
	// Per SCOPE §4.2 QC-4: Hero textarea "+ button" lets user attach reference
	// materials. Phase 2: image (Gemini vision describe → enrich outline prompt)
	// + PDF (text extract → enrich prompt). Phase 3 Max tier: audio (voice clone).
	// This endpoint returns a presigned R2 PUT URL — frontend uploads directly,
	// then attaches r2Key to session.configOverrides.heroAttachments[].
	app.post("/hero-attachments/presign", {
		schema: {
			body: z.object({
				workspaceId: z.string().uuid(),
				filename: z.string().min(1).max(200),
				mimeType: z.enum([
					"image/jpeg",
					"image/png",
					"image/webp",
					"application/pdf",
					"audio/mpeg",
					"audio/wav",
					"audio/mp4",
				]),
				sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
				kind: z.enum(["image", "pdf", "audio"]),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}
			// Sanitize filename — keep last 60 chars + replace non-alphanum.
			const safeName = req.body.filename
				.slice(-60)
				.replace(/[^a-zA-Z0-9.-]/g, "_");
			const r2Key = `quick-create/hero-attachments/${req.body.workspaceId}/${Date.now()}-${safeName}`;
			const command = new PutObjectCommand({
				Bucket: app.r2Buckets.uploads,
				Key: r2Key,
				ContentType: req.body.mimeType,
				ContentLength: req.body.sizeBytes,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const presignedUrl = await getSignedUrl(app.r2 as any, command as any, {
				expiresIn: 600,
			});
			req.log.info(
				{ userId: user.id, workspaceId: req.body.workspaceId, kind: req.body.kind, sizeBytes: req.body.sizeBytes },
				"hero-attachment presign issued",
			);
			// Public URL — same bucket region pattern as music. R2 public access
			// requires custom domain mapping; for now we return null and let LLM
			// enrichment fetch via signed read URLs.
			return {
				presignedUrl,
				r2Key,
				publicUrl: null,
				expiresInSec: 600,
			};
		},
	});

	// ─── Session lifecycle ─────────────────────────────────────────

	app.post("/sessions", {
		schema: { body: CreateSessionBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await ensureWorkspaceMember(req.body.workspaceId, user.id);
			if (!member) {
				reply.status(403);
				return { error: "Not a member of this workspace" };
			}
			// Persist hero attachments (QC-4) into configOverrides — outline route
			// reads heroAttachments[] and enriches LLM prompt with image describes
			// (Gemini vision) + PDF text extracts before calling DO Inference.
			const initialConfig = req.body.heroAttachmentR2Keys?.length
				? {
						heroAttachments: req.body.heroAttachmentR2Keys.map((r2Key) => ({
							r2Key,
							uploadedAt: new Date().toISOString(),
						})),
					}
				: undefined;

			const session = (await app.prisma.quickCreateSession.create({
				data: {
					userId: user.id,
					workspaceId: req.body.workspaceId,
					prompt: req.body.prompt,
					mode: req.body.mode === "pathA" ? "PATH_A" : "PATH_B",
					...(initialConfig ? { configOverrides: initialConfig } : {}),
				},
			})) as SessionRow;

			// Path B: quota gate + create job row + auto-trigger pipeline async.
			let pathBJobId: string | null = null;
			if (req.body.mode === "pathB" && req.body.pathBVideoUrl) {
				// Quota gate (D32): Standard 5min, Pro 30min, Max 120min /mo. We don't
				// know exact source video length until yt-dlp downloads — gate on
				// "any remaining minutes" (≥1) and increment with actual minutes after
				// pipeline completes.
				const quota = await checkPathBQuota(app.prisma, req.body.workspaceId, 1);
				if (!quota.allowed) {
					reply.code(429);
					return {
						error: "Path B quota exceeded for this month",
						reason: quota.reason,
						limit: quota.limit,
						used: quota.used,
						tier: quota.tier,
					};
				}

				try {
					const job = await app.prisma.reverseEngineerJob.create({
						data: {
							sessionId: session.id,
							userId: user.id,
							workspaceId: req.body.workspaceId,
							sourceUrl: req.body.pathBVideoUrl,
							status: "DOWNLOADING",
							progress: 1,
						},
					});
					pathBJobId = job.id;
					req.log.info(
						{ sessionId: session.id, jobId: job.id, sourceUrl: req.body.pathBVideoUrl },
						"path-b job auto-trigger pipeline",
					);

					// Fire-and-forget pipeline. Status updates happen inside runPathBPipeline.
					const sourceUrl = req.body.pathBVideoUrl;
					const workspaceId = req.body.workspaceId;
					void (async () => {
						try {
							const extraction = await runPathBPipeline({
								jobId: job.id,
								sessionId: session.id,
								sourceUrl,
								prisma: app.prisma,
								r2: app.r2 ?? null,
								r2Buckets: app.r2Buckets,
								logger: app.log,
							});
							const editorState = buildPathBEditorState(extraction);
							await app.prisma.reverseEngineerJob.update({
								where: { id: job.id },
								data: {
									status: "COMPLETED",
									progress: 100,
									completedAt: new Date(),
									outputEditorStateJson: editorState as never,
								},
							});
							// Increment quota tracker with actual source video minutes.
							const actualMinutes = secondsToQuotaMinutes(editorState.duration);
							await incrementPathBMinutes(app.prisma, workspaceId, actualMinutes);
							app.log.info(
								{ jobId: job.id, scenes: extraction.scenes.length, minutes: actualMinutes },
								"path-b pipeline complete",
							);
						} catch (err) {
							if (err instanceof JobCancelledError) {
								app.log.info({ jobId: job.id }, "path-b pipeline exited (cancelled)");
								return;
							}
							app.log.error({ jobId: job.id, err: String(err) }, "path-b pipeline FAILED");
							await app.prisma.reverseEngineerJob.update({
								where: { id: job.id },
								data: {
									status: "FAILED",
									errorMessage: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
								},
							});
						}
					})();
				} catch (err) {
					req.log.error({ err }, "failed to create reverse-engineer job");
				}
			}

			reply.status(201);
			return {
				...serializeSession(session),
				pathBVideoUrl: req.body.pathBVideoUrl ?? null,
				pathBJobId,
			};
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

	// PATCH /sessions/:id/notify — persist build-completion notification preference.
	// Audit BUG #8: previously checkbox was UI-only with no backend persistence.
	// Worker reads notifyEnabled from session.configOverrides on COMPLETED.
	app.patch("/sessions/:sessionId/notify", {
		schema: {
			params: SessionIdParamsSchema,
			body: z.object({ enabled: z.boolean() }),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const existingConfig =
				(result.session.configOverrides as Record<string, unknown> | null) ?? {};
			const updated = (await app.prisma.quickCreateSession.update({
				where: { id: req.params.sessionId },
				data: {
					configOverrides: {
						...existingConfig,
						notifyOnComplete: req.body.enabled,
					} as object,
				},
			})) as SessionRow;
			return { id: updated.id };
		},
	});

	// ─── Outline generation (Sprint 2 wire-up) ─────────────────────

	app.post("/sessions/:sessionId/outline", {
		schema: {
			params: SessionIdParamsSchema,
			querystring: z.object({
				live: z.coerce.boolean().optional(),
				lang: z.enum(["vi", "en"]).optional(),
			}),
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
				const language = (req.query.lang as Language | undefined) ?? workflow.defaultLanguage;

				// Crossian RAG gating (Q72 chốt): only `dropshipping` + `facebook-ad`
				// tags + language=`en` → fire RAG. v1 stub returns empty pattern;
				// Sprint 6 wires real pgvector similarity search.
				const ragEligible = isCrossianRagEligible(workflow, language);
				const crossianContext = ragEligible
					? "\n[PATTERN HINTS — apply 5-act structure when crafting hook + script]\n" +
					  "Hook variants: emotional / identity / gift / problem-solution\n" +
					  "Scene structure: Hook(0-3s) → Product Intro(3-7s) → Demo(7-15s) → Lifestyle(15-35s) → Social Proof+CTA(35-end)\n" +
					  "Text overlay examples: '4-Way Stretch' | '50% OFF Today Only' | 'Join 100,000+ Happy Customers'\n"
					: "";

				const platformChipDefault =
					workflow.platform.ratio === "9:16"
						? "tiktok"
						: workflow.platform.ratio === "4:5"
							? "fb-ad-vertical"
							: workflow.platform.ratio === "1:1"
								? "fb-feed"
								: "youtube-long";

				const llmPrompt = `You are a video script outline generator for PixStudio.

User prompt: ${session.prompt}

Workflow: ${workflow.name} — ${workflow.description}
Workflow tags: ${workflow.tags.join(", ") || "none"}
Default language: ${language}
Pace: ${workflow.pace}
Total duration: ${totalSec}s
Platform: ${workflow.platform.ratio} ratio
${crossianContext}
Generate exactly ${sceneCount} scenes that sum to ${totalSec}s ±5%.

Each scene must have:
- id (e.g. "scene-1")
- order (1-indexed integer)
- script (1-3 sentences in ${language === "vi" ? "Vietnamese" : "English"}, voice-friendly)
- mediaQuery (English keywords for stock search, e.g. "businessman office laptop")
- durationSec (number, scene length)

Also suggest:
- 1-3 audience chips (from registry: ecom-buyer, senior-50plus, office-worker, young-parents, gen-z-tiktok, gen-z-shorts, gen-z-youtube, mom-baby, fitness-enthusiast, beauty-shopper, food-lover, pet-owner, tech-adopter, gift-giver, pain-back, pain-skin, pain-weight, entertainment-seeker, family, student, ecom-seller, live-stream-host, gamer, travel, self-improve)
- 1-2 look-feel chips (from registry: ugc-authentic, ad-style, cinematic, vlog, comedy, dramatic, kawaii, food-porn, lifestyle, tech-modern, minimal, retro-80s)
- 1 platform chip (default ${platformChipDefault})

Return JSON ONLY (no markdown fence) matching:
{"title": string, "scenes": [{"id","order","script","mediaQuery","durationSec"}], "suggestedChips": {"audiences": string[], "lookFeel": string[], "platform": string}}

IMPORTANT: Do NOT mention "Crossian", "PATTERN HINTS", "framework", "RAG", or any source labels in the output. The hints above are for your internal use only.`;

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
					// Audit BUG #1 root cause: AI router result shape is
					// { providerId, costUsd, durationMs, mode, output: { text, model, usage } }
					// — text lives on llmResult.output.text, NOT llmResult.text. Reading
					// the wrong field is what caused every outline generation since
					// Sprint 2 to silently fall back to the mock template.
					const wrappedResult = llmResult as {
						output?: { text?: string };
						text?: string;
						costUsd?: number;
					};
					const text =
						wrappedResult.output?.text ?? wrappedResult.text ?? "";
					costUsd = wrappedResult.costUsd ?? 0;

					const parsed = parseOutlineLLMResponse(text);
					if (!parsed) {
						throw new Error(
							`LLM returned non-parseable response (len=${text.length}, head="${text.slice(0, 200).replace(/\n/g, " ")}")`,
						);
					}
					if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
						throw new Error(
							`LLM JSON parsed but missing scenes array (keys=${Object.keys(parsed).join(",")})`,
						);
					}
					const chips = (parsed.suggestedChips ?? {}) as {
						audiences?: unknown;
						lookFeel?: unknown;
						platform?: unknown;
					};
					outline = {
						title: String(parsed.title ?? "Untitled"),
						scenes: parsed.scenes.map((s: Record<string, unknown>, i: number) => ({
							id: String(s["id"] ?? `scene-${i + 1}`),
							order: Number(s["order"] ?? i + 1),
							script: String(s["script"] ?? ""),
							mediaQuery: String(s["mediaQuery"] ?? ""),
							durationSec: Number(s["durationSec"] ?? totalSec / sceneCount),
						})),
						suggestedChips: {
							audiences: Array.isArray(chips.audiences)
								? chips.audiences.slice(0, 3).map(String)
								: ["genz-tiktok"],
							lookFeel: Array.isArray(chips.lookFeel)
								? chips.lookFeel.slice(0, 2).map(String)
								: ["ad-style"],
							platform: String(
								chips.platform ??
									(workflow.platform.ratio === "9:16" ? "tiktok" : "youtube-long"),
							),
						},
					};
					req.log.info(
						{
							sessionId: session.id,
							sceneCount: outline.scenes.length,
							costUsd,
							durationMs,
						},
						"outline LLM success",
					);
				} catch (err) {
					req.log.warn(
						{ err: err instanceof Error ? err.message : String(err), sessionId: session.id },
						"outline LLM call failed — falling back to mock",
					);
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

			// Codex P1 #3: surface job removal failures so caller knows queue still has the job.
			// Worker also re-checks session.buildStatus === CANCELLED at each stage as defence
			// in depth (apps/api/src/plugins/queue.ts).
			let jobRemoved = false;
			let jobRemovalError: string | null = null;
			if (app.queues?.quickCreateBuild && session.buildJobId) {
				try {
					const job = await app.queues.quickCreateBuild.getJob(session.buildJobId);
					if (job) {
						await job.remove();
						jobRemoved = true;
					} else {
						jobRemoved = true; // job already gone (worker finished or expired)
					}
				} catch (err) {
					jobRemovalError = err instanceof Error ? err.message : String(err);
					req.log.warn({ err, jobId: session.buildJobId }, "BullMQ job remove failed");
				}
			}

			await app.prisma.quickCreateSession.update({
				where: { id: session.id },
				data: { buildStatus: "CANCELLED" as never, buildProgress: 0 },
			});

			return {
				sessionId: session.id,
				status: "CANCELLED",
				jobRemoved,
				jobRemovalError,
			};
		},
	});

	// WebSocket: stream build events via polling DB session.buildStatus.
	// Sprint 3 polish: replace polling với BullMQ Pub/Sub events.
	// Codex P1 #2: enforce auth + ownership on WS upgrade — req.user is populated
	// by require-auth preHandler from session cookie sent on the upgrade request.
	app.get(
		"/sessions/:sessionId/build/stream",
		{ websocket: true, schema: { params: SessionIdParamsSchema } },
		async (socket, req) => {
			if (!req.user) {
				socket.send(JSON.stringify({ type: "error", message: "unauthorized" }));
				socket.close();
				return;
			}
			const sessionId = (req.params as { sessionId: string }).sessionId;
			const session = await app.prisma.quickCreateSession.findUnique({
				where: { id: sessionId },
			});
			if (!session) {
				socket.send(JSON.stringify({ type: "error", message: "session not found" }));
				socket.close();
				return;
			}
			if (session.userId !== req.user.id) {
				socket.send(JSON.stringify({ type: "error", message: "forbidden" }));
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

	// Sprint 5: Path B reverse engineer pipeline.
	// Creates ReverseEngineerJob, returns 202 + jobId. Worker (Sprint 5 polish)
	// spawns GPU + runs FFmpeg → PySceneDetect → Demucs → Scribe → Chromaprint →
	// Gemini visual → editor state assembly.
	app.post("/sessions/:sessionId/reverse-engineer", {
		schema: {
			params: SessionIdParamsSchema,
			body: z
				.object({
					sourceUrl: z.string().url().optional(),
					sourceAssetId: z.string().uuid().optional(),
				})
				.refine((b) => Boolean(b.sourceUrl) !== Boolean(b.sourceAssetId), {
					message: "Provide exactly one of sourceUrl or sourceAssetId",
				}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const session = result.session;

			if (session.mode !== "PATH_B") {
				reply.code(400);
				return { error: "Session mode is not PATH_B — recreate session with mode=pathB" };
			}

			// Tier gate: Path B Standard 5min/mo, Pro 30min/mo, Max 120min/mo (D32).
			// Gate on remaining quota ≥ 1min — actual minutes incremented after pipeline.
			const quota = await checkPathBQuota(app.prisma, session.workspaceId, 1);
			if (!quota.allowed) {
				reply.code(429);
				return {
					error: "Path B quota exceeded for this month",
					reason: quota.reason,
					limit: quota.limit,
					used: quota.used,
					tier: quota.tier,
				};
			}

			// Idempotent: if a job already exists for this session, return existing.
			const existing = await app.prisma.reverseEngineerJob.findUnique({
				where: { sessionId: session.id },
			});
			if (existing) {
				return {
					sessionId: session.id,
					jobId: existing.id,
					status: existing.status,
					progress: existing.progress,
					message: "Job already exists for this session",
				};
			}

			const job = await app.prisma.reverseEngineerJob.create({
				data: {
					sessionId: session.id,
					userId: user.id,
					workspaceId: session.workspaceId,
					sourceUrl: req.body.sourceUrl,
					sourceAssetId: req.body.sourceAssetId,
					status: "PENDING",
					progress: 0,
				},
			});

			// TODO Sprint 5 polish: enqueue BullMQ job to spawn GPU + run pipeline.
			// const queueJob = await app.queues.reverseEngineerBuild.add("re-job", {
			//   jobId: job.id, sessionId: session.id, userId: user.id,
			// });

			reply.code(202);
			return {
				sessionId: session.id,
				jobId: job.id,
				status: job.status,
				progress: 0,
				message: "Job created. Worker will spawn GPU + run pipeline (Sprint 5 polish wires worker).",
			};
		},
	});

	app.get("/sessions/:sessionId/reverse-engineer", {
		schema: { params: SessionIdParamsSchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const result = await loadSession(req.params.sessionId, user.id);
			if (result.error) return handleSessionError(reply, result.error);
			const session = result.session;

			const job = await app.prisma.reverseEngineerJob.findUnique({
				where: { sessionId: session.id },
			});
			if (!job) {
				reply.code(404);
				return { error: "No reverse engineer job for this session" };
			}
			return {
				sessionId: session.id,
				jobId: job.id,
				status: job.status,
				progress: job.progress,
				errorMessage: job.errorMessage,
				totalCostUsd: Number(job.totalCostUsd),
				totalDurationMs: job.totalDurationMs,
				completedAt: job.completedAt?.toISOString() ?? null,
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
