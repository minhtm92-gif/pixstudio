/**
 * Admin KPI Dashboard — Sprint 8.
 *
 * ADMIN-only view consuming /api/admin/kpi/* endpoints.
 * Phase 1 success gate: ≥80% Editor team daily build (per Q57).
 */

import type { Metadata } from "next";
import { PageShell } from "@/components/pixstudio/page-shell";
import { KpiDashboard } from "@/components/admin/kpi-dashboard";
import { KpiHeader } from "@/components/admin/kpi-header";
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
			<KpiHeader />
			<div className="px-8 py-6">
				<KpiDashboard />
			</div>
		</PageShell>
	);
}
