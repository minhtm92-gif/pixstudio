/**
 * Project comments routes — Sprint S26 (PW-30 Frame.io style).
 *
 *   GET    /api/projects/:id/comments          — list (status filter)
 *   POST   /api/projects/:id/comments          — create top-level OR reply
 *   PATCH  /api/projects/:id/comments/:cid     — edit body OR resolve/archive
 *   DELETE /api/projects/:id/comments/:cid     — soft delete (archive)
 *
 * Pro tier feature per SCOPE PW-30. Comments thread 1-level deep
 * (no nested-nested replies in v1).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

const ProjectIdParams = z.object({ id: z.string().uuid() });
const CommentIdParams = z.object({
	id: z.string().uuid(),
	cid: z.string().uuid(),
});

const CreateCommentBody = z.object({
	body: z.string().min(1).max(2000),
	segmentId: z.string().optional(),
	timestampSec: z.number().nonnegative().optional(),
	parentCommentId: z.string().uuid().optional(),
});

const UpdateCommentBody = z.object({
	body: z.string().min(1).max(2000).optional(),
	status: z.enum(["OPEN", "RESOLVED", "ARCHIVED"]).optional(),
});

export const commentsRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/:id/comments", {
		schema: {
			params: ProjectIdParams,
			querystring: z.object({
				status: z.enum(["OPEN", "RESOLVED", "ARCHIVED", "ALL"]).default("OPEN"),
				limit: z.coerce.number().int().min(1).max(200).default(100),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.id },
				select: { workspaceId: true },
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
			const items = await app.prisma.projectComment.findMany({
				where: {
					projectId: req.params.id,
					...(req.query.status !== "ALL" ? { status: req.query.status } : {}),
				},
				orderBy: { createdAt: "asc" },
				take: req.query.limit,
			});
			return { items: items.map(serializeComment) };
		},
	});

	app.post("/:id/comments", {
		schema: { params: ProjectIdParams, body: CreateCommentBody },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.id },
				select: { workspaceId: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role to comment" };
			}
			const created = await app.prisma.projectComment.create({
				data: {
					projectId: req.params.id,
					authorId: user.id,
					body: req.body.body,
					segmentId: req.body.segmentId ?? null,
					timestampSec: req.body.timestampSec ?? null,
					parentCommentId: req.body.parentCommentId ?? null,
				},
			});
			req.log.info({ projectId: req.params.id, commentId: created.id }, "comment created");
			reply.code(201);
			return serializeComment(created);
		},
	});

	app.patch("/:id/comments/:cid", {
		schema: { params: CommentIdParams, body: UpdateCommentBody },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const existing = await app.prisma.projectComment.findUnique({
				where: { id: req.params.cid },
				select: { projectId: true, authorId: true, project: { select: { workspaceId: true } } },
			});
			if (!existing || existing.projectId !== req.params.id) {
				reply.code(404);
				return { error: "Comment not found" };
			}
			const member = await requireWorkspaceMember(app, existing.project.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			// Body edit allowed only by author. Status change allowed by any member.
			if (req.body.body !== undefined && existing.authorId !== user.id) {
				reply.code(403);
				return { error: "Only author can edit comment body" };
			}
			const data: Record<string, unknown> = {};
			if (req.body.body !== undefined) data.body = req.body.body;
			if (req.body.status !== undefined) {
				data.status = req.body.status;
				data.resolvedAt = req.body.status === "RESOLVED" ? new Date() : null;
			}
			const updated = await app.prisma.projectComment.update({
				where: { id: req.params.cid },
				data,
			});
			return serializeComment(updated);
		},
	});

	app.delete("/:id/comments/:cid", {
		schema: { params: CommentIdParams },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const existing = await app.prisma.projectComment.findUnique({
				where: { id: req.params.cid },
				select: { projectId: true, authorId: true, project: { select: { workspaceId: true } } },
			});
			if (!existing || existing.projectId !== req.params.id) {
				reply.code(404);
				return { error: "Comment not found" };
			}
			const member = await requireWorkspaceMember(app, existing.project.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role" };
			}
			// Author OR editor can soft-delete (archive)
			await app.prisma.projectComment.update({
				where: { id: req.params.cid },
				data: { status: "ARCHIVED" },
			});
			reply.code(204);
		},
	});
};

function serializeComment(c: {
	id: string;
	projectId: string;
	authorId: string;
	segmentId: string | null;
	timestampSec: import("@prisma/client/runtime/library").Decimal | null;
	body: string;
	status: string;
	parentCommentId: string | null;
	createdAt: Date;
	updatedAt: Date;
	resolvedAt: Date | null;
}) {
	return {
		id: c.id,
		projectId: c.projectId,
		authorId: c.authorId,
		segmentId: c.segmentId,
		timestampSec: c.timestampSec ? Number(c.timestampSec) : null,
		body: c.body,
		status: c.status,
		parentCommentId: c.parentCommentId,
		createdAt: c.createdAt.toISOString(),
		updatedAt: c.updatedAt.toISOString(),
		resolvedAt: c.resolvedAt?.toISOString() ?? null,
	};
}
