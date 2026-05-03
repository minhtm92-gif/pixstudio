/**
 * Quick Create → Editor handoff (Sprint 25).
 *
 * After build pipeline completes (BullMQ stages 1-4 done), Quick Create has
 * session.outlineJson.editorState ready. This route converts that into a
 * real Project row + returns the editor URL for redirect.
 *
 * POST /api/quick-create/sessions/:sessionId/handoff
 *   - Auth required, must own session
 *   - Reads session.outlineJson.editorState (Sprint 22 output)
 *   - Creates Project row with editorStateJson populated
 *   - Returns { projectId, editorUrl } so client can router.push
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

export const quickCreateHandoffRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post("/sessions/:sessionId/handoff", {
		schema: {
			params: z.object({ sessionId: z.string().uuid() }),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const session = (await app.prisma.quickCreateSession.findUnique({
				where: { id: req.params.sessionId },
			})) as {
				id: string;
				userId: string;
				workspaceId: string;
				prompt: string;
				outlineJson: unknown;
				buildStatus: string;
			} | null;

			if (!session) {
				reply.code(404);
				return { error: "Session not found" };
			}
			if (session.userId !== user.id) {
				reply.code(403);
				return { error: "Not your session" };
			}
			if (session.buildStatus !== "COMPLETED") {
				reply.code(400);
				return {
					error: `Build not complete (status=${session.buildStatus}). Wait for pipeline to finish.`,
				};
			}

			const outline = session.outlineJson as {
				title?: string;
				editorState?: Record<string, unknown>;
			} | null;

			if (!outline?.editorState) {
				reply.code(400);
				return {
					error: "Session has no editorState — build pipeline didn't reach stage 4 (compose).",
				};
			}

			// Create Project row with editorState pre-populated.
			const project = await app.prisma.project.create({
				data: {
					workspaceId: session.workspaceId,
					name: outline.title ?? `Quick Create: ${session.prompt.slice(0, 60)}`,
					description: `Auto-generated from Quick Create session ${session.id.slice(0, 8)}`,
					editorStateJson: outline.editorState as never,
					editorStateVersion: 1,
					lastEditedAt: new Date(),
				},
			});

			// Snapshot v1 immediately so user can revert to "as-built" state.
			await app.prisma.projectVersion.create({
				data: {
					projectId: project.id,
					versionNumber: 1,
					editorStateJson: outline.editorState as never,
					triggeredBy: user.id,
					triggerReason: "quick-create-handoff",
					label: "As built by Quick Create",
				},
			});

			req.log.info(
				{ sessionId: session.id, projectId: project.id },
				"quick-create handoff to editor",
			);

			return {
				projectId: project.id,
				editorUrl: `/editor/${project.id}`,
				title: project.name,
			};
		},
	});
};
