/**
 * KpiDashboard — admin view consuming /api/admin/kpi/* endpoints.
 *
 * 4 panels: Migration / Cost / Funnel / SystemHealth.
 */

"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Filter, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface MigrationKpi {
	windowDays: number;
	totalUsers: number;
	dailyActiveUsers: number;
	adoptionPct: number;
	targetPct: number;
	gateAchieved: boolean;
	dailyTrend: Array<{ day: string; builds: number; uniqueUsers: number }>;
}

interface CostKpi {
	windowDays: number;
	summary: {
		totalCostUsd: number;
		totalSessions: number;
		completedSessions: number;
		avgCostPerCompletedBuild: number;
		workspacesActive: number;
	};
	topWorkspaces: Array<{ workspaceId: string; sessionsCount: number; costUsd: number }>;
}

interface FunnelKpi {
	windowDays: number;
	funnel: Array<{ step: string; count: number; pctOfPrevious: number }>;
	failures: { failed: number; cancelled: number };
}

interface SystemHealth {
	timestamp: string;
	totals: { users: number; workspaces: number; projects: number; assets: number };
	realtime: { activeBuildSessions: number; stuckJobs: number };
	warnings: string[];
}

export function KpiDashboard() {
	const [migration, setMigration] = useState<MigrationKpi | null>(null);
	const [cost, setCost] = useState<CostKpi | null>(null);
	const [funnel, setFunnel] = useState<FunnelKpi | null>(null);
	const [health, setHealth] = useState<SystemHealth | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchAll = async () => {
			// Skip refetch when tab is backgrounded — avoids burning admin quota
			// while the dashboard isn't visible.
			if (typeof document !== "undefined" && document.visibilityState === "hidden") {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const [m, c, f, h] = await Promise.all([
					apiFetch<MigrationKpi>("/api/admin/kpi/migration?days=7"),
					apiFetch<CostKpi>("/api/admin/kpi/cost?days=30"),
					apiFetch<FunnelKpi>("/api/admin/kpi/build-funnel?days=7"),
					apiFetch<SystemHealth>("/api/admin/kpi/system-health"),
				]);
				setMigration(m);
				setCost(c);
				setFunnel(f);
				setHealth(h);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load KPIs");
			} finally {
				setLoading(false);
			}
		};
		void fetchAll();
		const interval = setInterval(() => void fetchAll(), 30_000); // 30s refresh
		return () => clearInterval(interval);
	}, []);

	if (loading && !migration) return <div className="text-sm text-muted-foreground">Loading KPIs...</div>;
	if (error) return <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>;

	return (
		<div className="space-y-6">
			{/* Migration */}
			{migration && (
				<KpiCard
					title="Phase 1 Success Gate — Editor Migration"
					icon={<TrendingUp className="h-5 w-5" />}
					primary={`${migration.adoptionPct}%`}
					secondary={`${migration.dailyActiveUsers} of ${migration.totalUsers} users built >0 videos in last ${migration.windowDays} days`}
					status={migration.gateAchieved ? "success" : "warning"}
					footer={
						<div className="text-xs">
							{migration.gateAchieved ? (
								<span className="text-green-600">✓ Gate achieved (target ≥{migration.targetPct}%)</span>
							) : (
								<span className="text-orange-600">↑ Need {migration.targetPct - migration.adoptionPct}% more to hit gate</span>
							)}
						</div>
					}
				>
					{migration.dailyTrend.length > 0 && (
						<div className="mt-3">
							<div className="text-[10px] uppercase text-muted-foreground">Daily trend</div>
							<div className="mt-1 flex h-12 items-end gap-1">
								{migration.dailyTrend.map((d) => {
									const max = Math.max(...migration.dailyTrend.map((x) => x.builds));
									const pct = max > 0 ? (d.builds / max) * 100 : 0;
									return (
										<div key={d.day} className="flex flex-1 flex-col items-center gap-0.5">
											<div className="w-full rounded-sm bg-primary" style={{ height: `${pct}%`, minHeight: 2 }} />
											<div className="text-[8px] text-muted-foreground">
												{d.day.slice(5)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</KpiCard>
			)}

			{/* Grid: Cost + Funnel + Health */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{cost && (
					<KpiCard
						title="Cost"
						icon={<DollarSign className="h-5 w-5" />}
						primary={`$${cost.summary.totalCostUsd.toFixed(2)}`}
						secondary={`${cost.windowDays}-day total · $${cost.summary.avgCostPerCompletedBuild.toFixed(3)}/build`}
					>
						<div className="mt-2 text-[10px] text-muted-foreground">
							{cost.summary.completedSessions} completed builds · {cost.summary.workspacesActive} workspaces
						</div>
					</KpiCard>
				)}
				{funnel && (
					<KpiCard
						title="Build Funnel"
						icon={<Filter className="h-5 w-5" />}
						primary={`${funnel.funnel[3]?.count ?? 0}`}
						secondary={`completed builds in ${funnel.windowDays} days`}
					>
						<div className="mt-2 space-y-1 text-[11px]">
							{funnel.funnel.map((step) => (
								<div key={step.step} className="flex items-center justify-between">
									<span className="text-muted-foreground">{step.step}</span>
									<span className="font-medium">
										{step.count} <span className="text-[10px] text-muted-foreground">({step.pctOfPrevious}%)</span>
									</span>
								</div>
							))}
							{(funnel.failures.failed > 0 || funnel.failures.cancelled > 0) && (
								<div className="border-t pt-1 text-[10px] text-orange-600">
									{funnel.failures.failed} failed · {funnel.failures.cancelled} cancelled
								</div>
							)}
						</div>
					</KpiCard>
				)}
				{health && (
					<KpiCard
						title="System Health"
						icon={<Activity className="h-5 w-5" />}
						primary={`${health.realtime.activeBuildSessions}`}
						secondary="active build sessions"
						status={health.warnings.length > 0 ? "warning" : "success"}
					>
						<div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
							<div className="text-muted-foreground">Users:</div>
							<div className="font-medium">{health.totals.users}</div>
							<div className="text-muted-foreground">Workspaces:</div>
							<div className="font-medium">{health.totals.workspaces}</div>
							<div className="text-muted-foreground">Projects:</div>
							<div className="font-medium">{health.totals.projects}</div>
							<div className="text-muted-foreground">Assets:</div>
							<div className="font-medium">{health.totals.assets}</div>
						</div>
						{health.warnings.length > 0 && (
							<div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600">
								<AlertTriangle className="h-3 w-3" />
								{health.warnings.join(", ")}
							</div>
						)}
					</KpiCard>
				)}
			</div>

			{/* Top workspaces by cost */}
			{cost && cost.topWorkspaces.length > 0 && (
				<div className="rounded-lg border bg-card p-4">
					<h3 className="mb-3 text-sm font-semibold">Top workspaces by cost (30d)</h3>
					<table className="w-full text-xs">
						<thead className="text-left text-muted-foreground">
							<tr>
								<th className="pb-2">Workspace</th>
								<th className="pb-2 text-right">Sessions</th>
								<th className="pb-2 text-right">Cost</th>
							</tr>
						</thead>
						<tbody>
							{cost.topWorkspaces.slice(0, 10).map((ws) => (
								<tr key={ws.workspaceId} className="border-t">
									<td className="py-1.5 font-mono text-[10px]">{ws.workspaceId.slice(0, 8)}...</td>
									<td className="py-1.5 text-right">{ws.sessionsCount}</td>
									<td className="py-1.5 text-right font-medium">${ws.costUsd.toFixed(3)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function KpiCard({
	title,
	icon,
	primary,
	secondary,
	status,
	children,
	footer,
}: {
	title: string;
	icon: React.ReactNode;
	primary: string;
	secondary: string;
	status?: "success" | "warning" | "error";
	children?: React.ReactNode;
	footer?: React.ReactNode;
}) {
	const statusColor = {
		success: "border-green-200 bg-green-50/30",
		warning: "border-orange-200 bg-orange-50/30",
		error: "border-red-200 bg-red-50/30",
	}[status ?? "success"];

	return (
		<div className={`rounded-lg border bg-card p-4 ${status ? statusColor : ""}`}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
					{icon}
					{title}
				</div>
				{status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
				{status === "warning" && <AlertTriangle className="h-4 w-4 text-orange-500" />}
			</div>
			<div className="mt-2 text-3xl font-bold">{primary}</div>
			<div className="text-xs text-muted-foreground">{secondary}</div>
			{children}
			{footer && <div className="mt-3 border-t pt-2">{footer}</div>}
		</div>
	);
}
