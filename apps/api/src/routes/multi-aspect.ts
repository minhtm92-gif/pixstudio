/**
 * Multi-aspect repurpose — Sprint S22 (D-2 SCOPE §4.5).
 *
 * Convert 1 project (e.g. master 16:9) into 6 aspect-ratio variants:
 *   16:9 (YouTube long), 9:16 (TikTok/Reel/Shorts), 1:1 (FB feed),
 *   4:5 (FB ad vertical), 21:9 (cinema), 4:3 (legacy)
 *
 * Server-side: clones Project + adjusts editorState aspect + crops/extends
 * existing scenes via FFmpeg. Output → new Project rows linked to source via
 * metadata.repurposedFromProjectId.
 *
 * Stub v1: clones editorStateJson + writes new aspect ratio + new project name
 * suffix. Real FFmpeg crop/letterbox per scene = S23+ polish (CPU-heavy on
 * 50MB+ source video, want to defer until anh stress-test usage).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

const RepurposeBodySchema = z.object({
	sourceProjectId: z.string().uuid(),
	targetAspects: z
		.array(z.enum(["16:9", "9:16", "1:1", "4:5", "21:9", "4:3"]))
		.min(1)
		.max(6),
});

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
	"16:9": { width: 1920, height: 1080, label: "Landscape (YouTube)" },
	"9:16": { width: 1080, height: 1920, label: "Portrait (TikTok/Reel/Shorts)" },
	"1:1": { width: 1080, height: 1080, label: "Square (FB feed)" },
	"4:5": { width: 1080, height: 1350, label: "Vertical FB Ad" },
	"21:9": { width: 2560, height: 1080, label: "Cinema ultrawide" },
	"4:3": { width: 1440, height: 1080, label: "Legacy 4:3" },
};

export const multiAspectRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post("/repurpose", {
		schema: { body: RepurposeBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const sourceProject = await app.prisma.project.findUnique({
				where: { id: req.body.sourceProjectId },
				select: {
					id: true,
					workspaceId: true,
					name: true,
					description: true,
					editorStateJson: true,
				},
			});
			if (!sourceProject) {
				reply.code(404);
				return { error: "Source project not found" };
			}
			const member = await requireWorkspaceMember(app, sourceProject.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}

			// Clone editor state per aspect — adjust totalDurationSec stays,
			// inject canvas dimensions + per-segment cropMode='center-crop'.
			const sourceState =
				(sourceProject.editorStateJson as Record<string, unknown> | null) ?? {};

			const created = await Promise.all(
				req.body.targetAspects.map(async (aspect) => {
					const dims = ASPECT_DIMENSIONS[aspect]!;
					const newState = {
						...sourceState,
						canvas: { width: dims.width, height: dims.height, aspect },
						repurposedFromProjectId: sourceProject.id,
						repurposedFromAspect:
							(sourceState as { canvas?: { aspect?: string } }).canvas?.aspect ?? null,
					};

					const newProject = await app.prisma.project.create({
						data: {
							workspaceId: sourceProject.workspaceId,
							name: `${sourceProject.name} (${aspect})`,
							description: `${sourceProject.description ?? ""}\n\nRepurposed from project ${sourceProject.id.slice(0, 8)} (${dims.label}).`,
							editorStateJson: newState as never,
							editorStateVersion: 1,
							lastEditedAt: new Date(),
						},
						select: { id: true, name: true },
					});

					req.log.info(
						{ sourceId: sourceProject.id, newId: newProject.id, aspect },
						"multi-aspect repurpose project created",
					);

					return {
						projectId: newProject.id,
						name: newProject.name,
						aspect,
						width: dims.width,
						height: dims.height,
					};
				}),
			);

			return {
				sourceProjectId: sourceProject.id,
				createdCount: created.length,
				projects: created,
				note: "Stub v1: editor state cloned with new canvas. FFmpeg per-scene crop/letterbox is S23+ polish (deferred until anh stress-test usage).",
			};
		},
	});

	// GET /api/multi-aspect/preview-dims — list of aspect → dims map (UI helper)
	app.get("/preview-dims", {
		handler: async () => {
			return {
				aspects: Object.entries(ASPECT_DIMENSIONS).map(([aspect, dims]) => ({
					aspect,
					...dims,
				})),
			};
		},
	});
};
