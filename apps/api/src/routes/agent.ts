/**
 * PixStudio Agent — context-aware chat helper for editor (Sprint 46+).
 *
 *   POST /api/agent/chat       — single-turn LLM with project context injected
 *   POST /api/agent/brainstorm — workspace-level brainstorm (no project context)
 *                                Used by Editor Inspector "AI" tab + Quick Create
 *                                Hero pre-flight idea expansion.
 *   POST /api/agent/voice-input — Web Speech API alternative — accepts audio
 *                                  blob → ElevenLabs Scribe → returns transcribed
 *                                  prompt for downstream textarea fill.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

const ChatBodySchema = z.object({
	projectId: z.string().uuid(),
	prompt: z.string().min(2).max(2000),
	selectedSegmentId: z.string().optional(),
});

const BrainstormBodySchema = z.object({
	workspaceId: z.string().uuid(),
	prompt: z.string().min(2).max(2000),
	intent: z
		.enum(["expand-idea", "rewrite-script", "suggest-hooks", "generate-titles"])
		.default("expand-idea"),
});

const VoiceInputBodySchema = z.object({
	audioR2Key: z.string().min(1),
	bucket: z.enum(["uploads", "derived"]).default("uploads"),
	languageCode: z.string().min(2).max(5).default("vi"),
});

interface AgentResponse {
	reply: string;
	actions?: Array<{
		type: "edit" | "regen" | "swap" | "add" | "remove";
		description: string;
		targetId?: string;
		params?: Record<string, unknown>;
	}>;
	costUsd: number;
}

export const agentRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post("/chat", {
		schema: { body: ChatBodySchema },
		handler: async (req, reply): Promise<AgentResponse | { error: string }> => {
			const user = requireUser(req, reply);
			if (!user) return { error: "Unauthorized" };

			const project = await app.prisma.project.findUnique({
				where: { id: req.body.projectId },
				select: {
					id: true,
					workspaceId: true,
					name: true,
					description: true,
					editorStateJson: true,
				},
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}

			if (!app.aiRouter) {
				reply.code(503);
				return { error: "AI router not configured" };
			}

			const editorState = project.editorStateJson as {
				totalDurationSec?: number;
				tracks?: Array<{
					id: string;
					kind: string;
					segments?: Array<{ id: string; sceneId?: string; text?: string; durationSec?: number; startSec?: number }>;
				}>;
			} | null;

			const tracks = editorState?.tracks ?? [];
			const sceneSummary = tracks
				.find((t) => t.kind === "subtitle")
				?.segments?.slice(0, 10)
				.map((s, i) => `Scene ${i + 1} (${s.durationSec}s): ${s.text?.slice(0, 100) ?? ""}`)
				.join("\n") ?? "(no scenes yet)";

			const selectedHint = req.body.selectedSegmentId
				? `\nUser is currently focused on segment ID: ${req.body.selectedSegmentId}`
				: "";

			const systemPrompt = `Bạn là PixStudio Agent — trợ lý AI cho editor video sản xuất quảng cáo.

PROJECT CONTEXT:
- Tên: ${project.name}
- Tổng thời lượng: ${editorState?.totalDurationSec ?? 0}s
- Số tracks: ${tracks.length} (${tracks.map((t) => t.kind).join(", ")})

SCENES (top 10):
${sceneSummary}
${selectedHint}

NHIỆM VỤ:
- Trả lời câu hỏi của user về project bằng tiếng Việt
- Khi phù hợp, đề xuất edits cụ thể dưới dạng JSON actions
- Pháp huy tone tự nhiên, ngắn gọn (max 3 đoạn)

OUTPUT FORMAT (JSON):
{
  "reply": "câu trả lời tự nhiên 1-3 đoạn",
  "actions": [
    { "type": "edit"|"regen"|"swap"|"add"|"remove",
      "description": "mô tả hành động",
      "targetId": "scene-X (optional)",
      "params": { ... } }
  ]
}

User prompt: ${req.body.prompt}`;

			try {
				const { result } = await app.aiRouter.invoke(
					"llm.chat" as never,
					{
						prompt: systemPrompt,
						maxTokens: 800,
						temperature: 0.7,
						responseFormat: "json_object",
					} as never,
					{ tier: "pro", workspaceId: project.workspaceId, userId: user.id } as never,
				);
				// Bug fix (S14 audit cascade): AI router shape is
				// { providerId, costUsd, durationMs, mode, output: { text, ... } }.
				const wrapped = result as {
					output?: { text?: string };
					text?: string;
					costUsd?: number;
				};
				const text = wrapped.output?.text ?? wrapped.text ?? "";
				const cost = wrapped.costUsd ?? 0;

				const jsonStart = text.indexOf("{");
				const jsonEnd = text.lastIndexOf("}");
				if (jsonStart === -1 || jsonEnd === -1) {
					return {
						reply: text || "Em không nghe rõ — anh hỏi lại nha.",
						costUsd: cost,
					};
				}
				const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
					reply?: string;
					actions?: AgentResponse["actions"];
				};
				return {
					reply: parsed.reply ?? "(no reply)",
					actions: parsed.actions,
					costUsd: cost,
				};
			} catch (err) {
				req.log.error({ err }, "Agent LLM failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "LLM error" };
			}
		},
	});

	// === S21 PW-28: Brainstorming AI panel ===
	// Workspace-level brainstorm (no project context). Editor Inspector "AI" tab
	// + Quick Create Hero idea expansion both call this.
	app.post("/brainstorm", {
		schema: { body: BrainstormBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return { error: "Unauthorized" };
			if (!app.aiRouter) {
				reply.code(503);
				return { error: "AI router not configured" };
			}

			const intentPrompts: Record<typeof req.body.intent, string> = {
				"expand-idea":
					"Mở rộng ý tưởng cho creator video tiếng Việt. Đưa ra 3-5 hướng phát triển + góc nhìn khả thi cho TikTok/Reel/YouTube. Mỗi hướng 2-3 câu.",
				"rewrite-script":
					"Viết lại script video sao cho ngắn gọn, voice-friendly, tone tự nhiên người Việt. Giữ key message, expand viết tắt + abbreviation.",
				"suggest-hooks":
					"Đề xuất 5 hook 3 giây đầu video cho creator Việt Nam. Mỗi hook 1 câu, đa dạng tone (emotional / problem-solution / curiosity / identity / gift).",
				"generate-titles":
					"Tạo 8 title video viral cho TikTok/Facebook Reel — mix hook word + benefit + urgency. Mỗi title <60 ký tự.",
			};

			const systemPrompt = `Bạn là PixStudio Brainstorming Agent — partner sáng tạo cho Vietnamese video creator.

INTENT: ${intentPrompts[req.body.intent]}

USER PROMPT:
${req.body.prompt}

OUTPUT FORMAT (JSON):
{
  "reply": "câu trả lời chính (markdown ok)",
  "suggestions": [
    { "title": "ngắn gọn", "body": "chi tiết 1-2 câu" }
  ]
}`;

			try {
				const { result } = await app.aiRouter.invoke(
					"llm.chat" as never,
					{
						prompt: systemPrompt,
						maxTokens: 1200,
						temperature: 0.85,
						responseFormat: "json_object",
					} as never,
					{ tier: "pro", workspaceId: req.body.workspaceId, userId: user.id } as never,
				);
				const wrapped = result as {
					output?: { text?: string };
					text?: string;
					costUsd?: number;
				};
				const text = wrapped.output?.text ?? wrapped.text ?? "";
				const cost = wrapped.costUsd ?? 0;
				const jsonStart = text.indexOf("{");
				const jsonEnd = text.lastIndexOf("}");
				if (jsonStart === -1 || jsonEnd === -1) {
					return {
						reply: text || "Em không nghe rõ — anh hỏi lại nha.",
						suggestions: [],
						costUsd: cost,
						intent: req.body.intent,
					};
				}
				const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
					reply?: string;
					suggestions?: Array<{ title?: string; body?: string }>;
				};
				return {
					reply: parsed.reply ?? text,
					suggestions: parsed.suggestions ?? [],
					costUsd: cost,
					intent: req.body.intent,
				};
			} catch (err) {
				req.log.error({ err }, "Brainstorm LLM failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "LLM error" };
			}
		},
	});

	// === S21 QC-2: Voice input transcription ===
	// Frontend records audio via MediaRecorder → uploads to R2 → calls this →
	// receives transcribed text → fills Hero textarea. Better than Web Speech API
	// for Vietnamese (Web Speech VN support is unreliable).
	app.post("/voice-input", {
		schema: { body: VoiceInputBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return { error: "Unauthorized" };
			if (!app.aiRouter) {
				reply.code(503);
				return { error: "AI router not configured" };
			}
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}
			const bucketName =
				req.body.bucket === "derived" ? app.r2Buckets.derived : app.r2Buckets.uploads;
			try {
				const obj = await app.r2.send(
					new GetObjectCommand({ Bucket: bucketName, Key: req.body.audioR2Key }),
				);
				if (!obj.Body) {
					reply.code(404);
					return { error: "Audio R2 object empty" };
				}
				const chunks: Uint8Array[] = [];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				for await (const chunk of obj.Body as any) chunks.push(chunk as Uint8Array);
				const buf = Buffer.concat(chunks);
				const audioBlob = new Blob([buf], { type: "audio/mpeg" });
				const { result } = await app.aiRouter.invoke(
					"stt.transcribe" as never,
					{
						audioBlob,
						languageCode: req.body.languageCode,
						diarize: false,
						timestampsGranularity: "none",
					} as never,
					{ tier: "pro", workspaceId: "", userId: user.id } as never,
				);
				const wrapped = result as {
					output?: { text?: string };
					costUsd?: number;
				};
				return {
					text: wrapped.output?.text ?? "",
					costUsd: wrapped.costUsd ?? 0,
					languageCode: req.body.languageCode,
				};
			} catch (err) {
				req.log.error({ err }, "Voice input transcribe failed");
				reply.code(502);
				return { error: err instanceof Error ? err.message : "Scribe error" };
			}
		},
	});
};
