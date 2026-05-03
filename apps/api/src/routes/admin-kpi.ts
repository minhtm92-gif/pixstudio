/**
 * Admin KPI dashboard routes — Sprint 7.
 *
 * ADMIN-only. Aggregates metrics for migration tracking + cost analytics:
 * - Phase 1 success gate: ≥80% Editor team daily PixStudio thay CapCut sau 4 tuần
 *   (per Q57: build count >1/day per user)
 * - Cost per workspace + total
 * - Active sessions / projects / quick create completions
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAdmin } from "../plugins/require-auth.js";

/**
 * Editor team email allowlist for Phase 1 success-gate measurement (Q55).
 * Comma-separated env var EDITOR_TEAM_EMAILS overrides default list.
 */
function editorTeamEmails(): string[] {
	const env = process.env["EDITOR_TEAM_EMAILS"];
	if (env) return env.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
	return [
		"minhtq@pixelxlab.com", // anh Minh (CEO)
		"tungv@pixelxlab.com",  // Tùng (Marketer Leader)
	];
}

export const adminKpiRoutes: FastifyPluginAsyncZod = async (app) => {
	// === GET /api/admin/kpi/migration ===
	// Phase 1 success gate metric: % of Editor team users with build_count > 0 today
	app.get("/kpi/migration", {
		schema: {
			querystring: z.object({
				days: z.coerce.number().int().min(1).max(30).default(7),
				editorTeamOnly: z.coerce.boolean().default(true),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const since = new Date();
			since.setDate(since.getDate() - req.query.days);

			// Editor team filter (Q55) — allowlist by email when editorTeamOnly=true.
			const allowlist = editorTeamEmails();
			const editorTeamUsers = req.query.editorTeamOnly
				? await app.prisma.user.findMany({
					where: { email: { in: allowlist }, systemRole: "USER" },
					select: { id: true, email: true },
				})
				: await app.prisma.user.findMany({
					where: { systemRole: "USER" },
					select: { id: true, email: true },
				});
			const editorTeamUserIds = editorTeamUsers.map((u) => u.id);
			const totalUsers = editorTeamUsers.length;

			// Users with completed build in window (filtered to editor team if requested).
			const activeUserIds = await app.prisma.quickCreateSession.findMany({
				where: {
					completedAt: { gte: since },
					buildStatus: "COMPLETED",
					...(req.query.editorTeamOnly && editorTeamUserIds.length > 0
						? { userId: { in: editorTeamUserIds } }
						: {}),
				},
				select: { userId: true },
				distinct: ["userId"],
			});

			const dailyActiveUsers = activeUserIds.length;
			const adoptionPct = totalUsers > 0 ? Math.round((dailyActiveUsers / totalUsers) * 100) : 0;

			// Build counts per day for trend chart
			const builds = await app.prisma.quickCreateSession.findMany({
				where: {
					completedAt: { gte: since },
					buildStatus: "COMPLETED",
				},
				select: { completedAt: true, userId: true },
			});
			const dailyBuckets: Record<string, { builds: number; uniqueUsers: Set<string> }> = {};
			for (const b of builds) {
				if (!b.completedAt) continue;
				const day = b.completedAt.toISOString().slice(0, 10);
				if (!dailyBuckets[day]) {
					dailyBuckets[day] = { builds: 0, uniqueUsers: new Set() };
				}
				dailyBuckets[day].builds++;
				dailyBuckets[day].uniqueUsers.add(b.userId);
			}

			return {
				windowDays: req.query.days,
				totalUsers,
				dailyActiveUsers,
				adoptionPct,
				targetPct: 80, // Phase 1 success gate per scope
				gateAchieved: adoptionPct >= 80,
				dailyTrend: Object.entries(dailyBuckets)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([day, stats]) => ({
						day,
						builds: stats.builds,
						uniqueUsers: stats.uniqueUsers.size,
					})),
			};
		},
	});

	// === GET /api/admin/kpi/cost ===
	// Polish Sprint 7+: depends on UsageTracker (Sprint 6 schema). Wired after
	// Sprint 6 PR #14 merges. v1: returns aggregate via QuickCreateSession.totalCostUsd.
	app.get("/kpi/cost", {
		schema: {
			querystring: z.object({
				days: z.coerce.number().int().min(1).max(90).default(30),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const since = new Date();
			since.setDate(since.getDate() - req.query.days);

			const sessions = await app.prisma.quickCreateSession.findMany({
				where: { createdAt: { gte: since } },
				select: { totalCostUsd: true, workspaceId: true, buildStatus: true },
			});

			const totalCostUsd = sessions.reduce((sum, s) => sum + Number(s.totalCostUsd), 0);
			const completedSessions = sessions.filter((s) => s.buildStatus === "COMPLETED");
			const avgCostPerCompletedBuild =
				completedSessions.length > 0
					? totalCostUsd / completedSessions.length
					: 0;

			// Group by workspace
			const byWorkspace = new Map<string, { sessions: number; cost: number }>();
			for (const s of sessions) {
				const cur = byWorkspace.get(s.workspaceId) ?? { sessions: 0, cost: 0 };
				cur.sessions++;
				cur.cost += Number(s.totalCostUsd);
				byWorkspace.set(s.workspaceId, cur);
			}

			return {
				windowDays: req.query.days,
				summary: {
					totalCostUsd,
					totalSessions: sessions.length,
					completedSessions: completedSessions.length,
					avgCostPerCompletedBuild,
					workspacesActive: byWorkspace.size,
				},
				topWorkspaces: Array.from(byWorkspace.entries())
					.sort(([, a], [, b]) => b.cost - a.cost)
					.slice(0, 20)
					.map(([workspaceId, stats]) => ({
						workspaceId,
						sessionsCount: stats.sessions,
						costUsd: stats.cost,
					})),
			};
		},
	});

	// === GET /api/admin/kpi/build-funnel ===
	// Quick Create funnel: created → outline → build → completed (drop-off rates)
	app.get("/kpi/build-funnel", {
		schema: {
			querystring: z.object({
				days: z.coerce.number().int().min(1).max(30).default(7),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const since = new Date();
			since.setDate(since.getDate() - req.query.days);

			// 6 counts in parallel — saves ~150ms vs sequential awaits.
			const [created, outlined, buildStarted, completed, failed, cancelled] = await Promise.all([
				app.prisma.quickCreateSession.count({ where: { createdAt: { gte: since } } }),
				app.prisma.quickCreateSession.count({
					where: { createdAt: { gte: since }, outlineJson: { not: null as never } },
				}),
				app.prisma.quickCreateSession.count({
					where: { createdAt: { gte: since }, buildJobId: { not: null } },
				}),
				app.prisma.quickCreateSession.count({
					where: { createdAt: { gte: since }, buildStatus: "COMPLETED" },
				}),
				app.prisma.quickCreateSession.count({
					where: { createdAt: { gte: since }, buildStatus: "FAILED" },
				}),
				app.prisma.quickCreateSession.count({
					where: { createdAt: { gte: since }, buildStatus: "CANCELLED" },
				}),
			]);

			return {
				windowDays: req.query.days,
				funnel: [
					{ step: "Session created", count: created, pctOfPrevious: 100 },
					{
						step: "Outline generated",
						count: outlined,
						pctOfPrevious: created > 0 ? Math.round((outlined / created) * 100) : 0,
					},
					{
						step: "Build started",
						count: buildStarted,
						pctOfPrevious: outlined > 0 ? Math.round((buildStarted / outlined) * 100) : 0,
					},
					{
						step: "Build completed",
						count: completed,
						pctOfPrevious:
							buildStarted > 0 ? Math.round((completed / buildStarted) * 100) : 0,
					},
				],
				failures: { failed, cancelled },
			};
		},
	});

	// === GET /api/admin/kpi/system-health ===
	app.get("/kpi/system-health", {
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const [
				userCount,
				workspaceCount,
				projectCount,
				assetCount,
				activeSessions,
				stuckJobs,
			] = await Promise.all([
				app.prisma.user.count(),
				app.prisma.workspace.count(),
				app.prisma.project.count({ where: { archived: false } }),
				app.prisma.asset.count(),
				app.prisma.quickCreateSession.count({
					where: {
						buildStatus: {
							in: [
								"GENERATING_SCRIPT",
								"SYNTHESIZING_VOICE",
								"MATCHING_STOCK",
								"COMPOSING_SCENES",
								"RENDERING_PREVIEW",
							] as never,
						},
					},
				}),
				// Stuck = active job > 30min old
				app.prisma.quickCreateSession.count({
					where: {
						buildStatus: {
							in: [
								"GENERATING_SCRIPT",
								"SYNTHESIZING_VOICE",
								"MATCHING_STOCK",
								"COMPOSING_SCENES",
								"RENDERING_PREVIEW",
							] as never,
						},
						updatedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
					},
				}),
			]);

			return {
				timestamp: new Date().toISOString(),
				totals: {
					users: userCount,
					workspaces: workspaceCount,
					projects: projectCount,
					assets: assetCount,
				},
				realtime: {
					activeBuildSessions: activeSessions,
					stuckJobs,
				},
				warnings: stuckJobs > 0 ? ["stuck-jobs-detected"] : [],
			};
		},
	});

	// === GET /api/admin/kpi/export.csv ===
	// CSV export of completed builds for offline analysis (Q44 polish).
	app.get("/kpi/export.csv", {
		schema: {
			querystring: z.object({
				days: z.coerce.number().int().min(1).max(90).default(30),
			}),
		},
		handler: async (req, reply) => {
			const user = await requireAdmin(app, req, reply);
			if (!user) return;

			const since = new Date();
			since.setDate(since.getDate() - req.query.days);

			const sessions = await app.prisma.quickCreateSession.findMany({
				where: { createdAt: { gte: since } },
				select: {
					id: true,
					userId: true,
					workspaceId: true,
					workflowId: true,
					mode: true,
					buildStatus: true,
					totalCostUsd: true,
					createdAt: true,
					completedAt: true,
				},
				orderBy: { createdAt: "desc" },
			});

			const escape = (v: unknown): string => {
				if (v === null || v === undefined) return "";
				const s = String(v);
				return s.includes(",") || s.includes('"') || s.includes("\n")
					? `"${s.replace(/"/g, '""')}"`
					: s;
			};
			const header = [
				"sessionId",
				"userId",
				"workspaceId",
				"workflowId",
				"mode",
				"buildStatus",
				"totalCostUsd",
				"createdAt",
				"completedAt",
			].join(",");
			const rows = sessions.map((s) =>
				[
					escape(s.id),
					escape(s.userId),
					escape(s.workspaceId),
					escape(s.workflowId),
					escape(s.mode),
					escape(s.buildStatus),
					escape(Number(s.totalCostUsd).toFixed(4)),
					escape(s.createdAt.toISOString()),
					escape(s.completedAt?.toISOString() ?? ""),
				].join(","),
			);
			const body = [header, ...rows].join("\n");

			reply.header("Content-Type", "text/csv; charset=utf-8");
			reply.header(
				"Content-Disposition",
				`attachment; filename="pixstudio-kpi-${req.query.days}d.csv"`,
			);
			return body;
		},
	});
};
