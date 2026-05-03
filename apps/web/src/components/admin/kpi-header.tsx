/**
 * KPI Dashboard header with title + admin actions (CSV export, etc.)
 *
 * Split out from page.tsx so action buttons can use client-side handlers
 * (download trigger via fetch + Blob).
 */

"use client";

import { useState } from "react";
import { Lock, Download, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api-client";

export function KpiHeader() {
	const [downloading, setDownloading] = useState(false);
	const [days, setDays] = useState(30);

	const handleDownload = async () => {
		setDownloading(true);
		try {
			const res = await fetch(`${API_BASE}/api/admin/kpi/export.csv?days=${days}`, {
				credentials: "include",
			});
			if (!res.ok) {
				alert(
					res.status === 401 || res.status === 403
						? "Admin role required. Login với account ADMIN."
						: `Download failed: HTTP ${res.status}`,
				);
				return;
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `pixstudio-kpi-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			alert(err instanceof Error ? err.message : "Download failed");
		} finally {
			setDownloading(false);
		}
	};

	return (
		<div className="px-8 pt-6">
			<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Admin / KPI</div>
			<div className="flex items-start justify-between gap-4">
				<div>
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

				<div className="flex shrink-0 items-center gap-2">
					<select
						value={days}
						onChange={(e) => setDays(Number(e.target.value))}
						className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white/87 hover:bg-zinc-800"
						disabled={downloading}
					>
						<option value={7}>Last 7 days</option>
						<option value={30}>Last 30 days</option>
						<option value={90}>Last 90 days</option>
					</select>
					<button
						type="button"
						onClick={handleDownload}
						disabled={downloading}
						className="flex items-center gap-1.5 rounded-md bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
					>
						{downloading ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Downloading...
							</>
						) : (
							<>
								<Download className="h-3.5 w-3.5" />
								Export CSV
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
