/**
 * Admin KPI Dashboard — Sprint 8.
 *
 * ADMIN-only view consuming /api/admin/kpi/* endpoints.
 * Phase 1 success gate: ≥80% Editor team daily build (per Q57).
 */

import type { Metadata } from "next";
import { KpiDashboard } from "../../../components/admin/kpi-dashboard";

export const metadata: Metadata = {
	title: "KPI Dashboard · Admin · PixStudio",
};

export default function AdminKpiPage() {
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<header className="mb-6">
					<h1 className="text-2xl font-bold">KPI Dashboard</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Phase 1 migration tracking + cost analytics + system health
					</p>
				</header>
				<KpiDashboard />
			</div>
		</main>
	);
}
