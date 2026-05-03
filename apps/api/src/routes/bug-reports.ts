/**
 * Bug Reports — Sprint 7 internal alpha bug bash.
 *
 * In-app feedback for Editor team. Admin triages via /api/admin/bug-reports.
 *
 * Endpoints:
 * - POST /api/bug-reports               — submit (any authed user)
 * - GET  /api/bug-reports/mine          — list my reports
 * - GET  /api/bug-reports/:id           — fetch single
 * - GET  /api/admin/bug-reports         — list all (admin)
 * - PATCH /api/admin/bug-reports/:id    — triage (admin: assign, status, severity)
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireAdmin } from "../plugins/require-auth.js";

const BugSeveritySchema = z.enum(["P0", "P1", "P2", "P3"]);
const BugStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX", "DUPLICATE"]);

const SubmitBodySchema = z.object({
	title: z.string().min(3).max(200),
	description: z.string().min(10).max(5000),
	severity: BugSeveritySchema.default("P2"),
	workspaceId: z.string().uuid().optional(),
	projectId: z.string().uuid().optional(),
	pageUrl: z.string().url().optional(),
	userAgent: z.string().max(500).optional(),
	consoleErrors: z.string().max(10000).optional(),
	screenshotR2Key: z.string().optional(),
});

const TriageBodySchema = z.object({
	severity: BugSeveritySchema.optional(),
	status: BugStatusSchema.optional(),
	assignedTo: z.string().uuid().nullable().optional(),
	resolution: z.string().max(2000).optional(),
});

interface BugRow {
	id: string;
	reporterId: string;
	workspaceId: string | null;
	projectId: string | null;
	title: string;
	description: string;
	severity: "P0" | "P1" | "P2" | "P3";
	status: "OPEN" | "IN_PROGRESS" | "FIXED" | "WONT_FIX" | "DUPLICATE";
	pageUrl: string | null;
	userAgent: string | null;
	consoleErrors: string | null;
	screenshotR2Key: string | null;
	assignedTo: string | null;
	resolvedAt: Date | null;
	resolution: string | null;
	createdAt: Date;
	updatedAt: Date;
}

const serialize = (b: BugRow) => ({
	...b,
	resolvedAt: b.resolvedAt?.toISOString() ?? null,
	createdAt: b.createdAt.toISOString(),
	updatedAt: b.updatedAt.toISOString(),
});

export const bugReportsRoutes: FastifyPluginAsyncZod = async (app) => {
	// === POST /api/bug-reports ===
	app.post("/", {
		schema: { body: SubmitBodySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const bug = (await app.prisma.bugReport.create({
				data: {
					reporterId: user.id,
					...req.body,
				},
			})) as BugRow;

			req.log.info(
				{ bugId: bug.id, severity: bug.severity, reporter: user.email },
				"bug report submitted",
			);

			reply.code(201);
			return serialize(bug);
		},
	});

	// === GET /api/bug-reports/mine ===
	app.get("/mine", {
		schema: {
			querystring: z.object({
				status: BugStatusSchema.optional(),
				limit: z.coerce.number().int().min(1).max(100).default(20),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const where: Record<string, unknown> = { reporterId: user.id };
			if (req.query.status) where["status"] = req.query.status;

			const items = (await app.prisma.bugReport.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: req.query.limit,
			})) as BugRow[];

			return { items: items.map(serialize) };
		},
	});

	// === GET /api/bug-reports/:id ===
	app.get("/:id", {
		schema: { params: z.object({ id: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			const bug = (await app.prisma.bugReport.findUnique({
				where: { id: req.params.id },
			})) as BugRow | null;

			if (!bug) {
				reply.code(404);
				return { error: "Bug report not found" };
			}

			// Reporter or admin/mod can view
			if (bug.reporterId !== user.id) {
				const dbUser = await app.prisma.user.findUnique({
					where: { id: user.id },
					select: { systemRole: true },
				});
				if (dbUser?.systemRole !== "ADMIN" && dbUser?.systemRole !== "MOD") {
					reply.code(403);
					return { error: "Not authorized" };
				}
			}

			return serialize(bug);
		},
	});
};

/**
 * Admin triage routes — registered separately under /api/admin/bug-reports.
 */
export const adminBugReportsRoutes: FastifyPluginAsyncZod = async (app) => {
	// === GET /api/admin/bug-reports ===
	app.get("/bug-reports", {
		schema: {
			querystring: z.object({
				status: BugStatusSchema.optional(),
				severity: BugSeveritySchema.optional(),
				limit: z.coerce.number().int().min(1).max(500).default(50),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply, { allowMod: true });
			if (!user) return;

			const where: Record<string, unknown> = {};
			if (req.query.status) where["status"] = req.query.status;
			if (req.query.severity) where["severity"] = req.query.severity;

			const items = (await app.prisma.bugReport.findMany({
				where,
				orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
				take: req.query.limit,
			})) as BugRow[];

			return { items: items.map(serialize) };
		},
	});

	// === PATCH /api/admin/bug-reports/:id ===
	app.patch("/bug-reports/:id", {
		schema: {
			params: z.object({ id: z.string().uuid() }),
			body: TriageBodySchema,
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply, { allowMod: true });
			if (!user) return;

			const updates: Record<string, unknown> = { ...req.body };
			// Auto-set resolvedAt when status moves to terminal state
			if (
				req.body.status &&
				["FIXED", "WONT_FIX", "DUPLICATE"].includes(req.body.status)
			) {
				updates["resolvedAt"] = new Date();
			}
			// Codex P2: clear resolvedAt when reopened (status back to OPEN/IN_PROGRESS)
			if (
				req.body.status &&
				["OPEN", "IN_PROGRESS"].includes(req.body.status)
			) {
				updates["resolvedAt"] = null;
			}

			const updated = (await app.prisma.bugReport.update({
				where: { id: req.params.id },
				data: updates as never,
			})) as BugRow;

			return serialize(updated);
		},
	});
};
