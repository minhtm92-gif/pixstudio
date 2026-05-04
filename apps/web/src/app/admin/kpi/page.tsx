/**
 * Admin KPI Dashboard — Sprint 8.
 *
 * ADMIN-only view consuming /api/admin/kpi/* endpoints.
 * Phase 1 success gate: ≥80% Editor team daily build (per Q57).
 */

"use client";

import { PageShell } from "@/components/pixstudio/page-shell";
import { KpiDashboard } from "@/components/admin/kpi-dashboard";
import { KpiHeader } from "@/components/admin/kpi-header";
import { useAuthUser } from "@/hooks/use-auth-user";

export default function AdminKpiPage() {
	const { user } = useAuthUser();
	return (
		<PageShell user={user}>
			<KpiHeader />
			<div className="px-8 py-6">
				<KpiDashboard />
			</div>
		</PageShell>
	);
}
