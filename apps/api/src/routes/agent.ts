/**
 * PixStudio Agent — context-aware chat helper for editor (Sprint 46).
 *
 *   POST /api/agent/chat — single-turn LLM with project context injected
 *
 * Reads project editor state + user prompt → returns reply + optional
 * structured action proposals (frontend renders as clickable buttons).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

const ChatBodySchema = z.object({
	projectId: z.string().uuid(),
	prompt: z.string().min(2).max(2000),
	selectedSegmentId: z.string().optional(),
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
				const text = (result as { text?: string }).text ?? "";
				const cost = (result as { costUsd?: number }).costUsd ?? 0;

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
};
