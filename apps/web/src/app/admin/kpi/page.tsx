/**
 * Admin KPI Dashboard — Sprint 8.
 *
 * ADMIN-only view consuming /api/admin/kpi/* endpoints.
 * Phase 1 success gate: ≥80% Editor team daily build (per Q57).
 */

import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { KpiDashboard } from "@/components/admin/kpi-dashboard";
import type { PixStudioUser } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "KPI Dashboard · Admin · PixStudio",
};

const STUB_USER: PixStudioUser = {
	name: "Admin",
	tier: "MAX",
	buildsUsed: 0,
	buildsLimit: -1,
};

export default function AdminKpiPage() {
	return (
		<PageShell user={STUB_USER}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Admin / KPI</div>
				<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
					KPI Dashboard
					<span className="flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-400">
						<Lock className="h-3 w-3" />
						Admin Only
					</span>
				</h1>
				<p className="mt-1.5 text-sm text-white/50">
					Phase 1 migration tracking + cost analytics + system health · auto-refresh 30s
				</p>
			</div>
			<div className="px-8 py-6">
				<KpiDashboard />
			</div>
		</PageShell>
	);
}
