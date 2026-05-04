/**
 * Admin Bug Reports triage page — list + filter + status update.
 *
 * Wires to GET /api/admin/bug-reports + PATCH /api/admin/bug-reports/:id
 * (shipped Sprint 7 + Sprint 9). ADMIN/MOD role required.
 */

"use client";

import { useEffect, useState } from "react";
import { Lock, AlertTriangle, AlertCircle, Info, CheckCircle2, Bug, Loader2 } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { apiFetch } from "@/lib/api-client";
import { useAuthUser } from "@/hooks/use-auth-user";

type Severity = "P0" | "P1" | "P2" | "P3";
type Status = "OPEN" | "IN_PROGRESS" | "FIXED" | "WONT_FIX" | "DUPLICATE";

interface BugReport {
	id: string;
	reporterId: string;
	title: string;
	description: string;
	severity: Severity;
	status: Status;
	pageUrl: string | null;
	createdAt: string;
	resolvedAt: string | null;
}

const SEVERITY_META: Record<Severity, { icon: React.ReactNode; cls: string }> = {
	P0: { icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: "border-red-500/40 bg-red-500/10 text-red-300" },
	P1: { icon: <AlertCircle className="h-3.5 w-3.5" />, cls: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
	P2: { icon: <Info className="h-3.5 w-3.5" />, cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
	P3: { icon: <Info className="h-3.5 w-3.5" />, cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
};

const STATUS_META: Record<Status, { label: string; cls: string }> = {
	OPEN: { label: "Open", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
	IN_PROGRESS: { label: "In Progress", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
	FIXED: { label: "Fixed", cls: "border-green-500/40 bg-green-500/10 text-green-300" },
	WONT_FIX: { label: "Won't Fix", cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400" },
	DUPLICATE: { label: "Duplicate", cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400" },
};

export default function AdminBugReportsPage() {
	const { user } = useAuthUser();
	const [bugs, setBugs] = useState<BugReport[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filterStatus, setFilterStatus] = useState<Status | "ALL">("OPEN");
	const [filterSeverity, setFilterSeverity] = useState<Severity | "ALL">("ALL");
	const [updating, setUpdating] = useState<string | null>(null);

	const load = async () => {
		try {
			const params = new URLSearchParams();
			if (filterStatus !== "ALL") params.set("status", filterStatus);
			if (filterSeverity !== "ALL") params.set("severity", filterSeverity);
			params.set("limit", "100");
			const data = await apiFetch<{ items: BugReport[] }>(
				`/api/admin/bug-reports?${params.toString()}`,
			);
			setBugs(data.items);
			setError(null);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed";
			setError(
				msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("admin")
					? "Admin/MOD role required"
					: msg,
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, [filterStatus, filterSeverity]);

	const handleStatusChange = async (id: string, newStatus: Status) => {
		setUpdating(id);
		try {
			await apiFetch(`/api/admin/bug-reports/${id}`, {
				method: "PATCH",
				body: JSON.stringify({ status: newStatus }),
			});
			await load();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Update failed");
		} finally {
			setUpdating(null);
		}
	};

	return (
		<PageShell user={user}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Admin / Bug Reports</div>
				<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
					<Bug className="h-7 w-7 text-orange-400" />
					Bug Reports Triage
					<span className="flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-400">
						<Lock className="h-3 w-3" />
						Admin / MOD
					</span>
				</h1>
				<p className="mt-1.5 text-sm text-white/50">
					Editor team in-app bug reports (Q57 internal alpha bug bash) ·{" "}
					{loading ? "loading…" : `${bugs.length} match`}
				</p>
			</div>

			<div className="px-8 pt-4">
				<div className="flex flex-wrap items-center gap-2">
					<select
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value as Status | "ALL")}
						className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white/87"
					>
						<option value="ALL">All statuses</option>
						{(Object.keys(STATUS_META) as Status[]).map((s) => (
							<option key={s} value={s}>
								{STATUS_META[s].label}
							</option>
						))}
					</select>
					<select
						value={filterSeverity}
						onChange={(e) => setFilterSeverity(e.target.value as Severity | "ALL")}
						className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white/87"
					>
						<option value="ALL">All severities</option>
						<option value="P0">P0 Critical</option>
						<option value="P1">P1 Major</option>
						<option value="P2">P2 Minor</option>
						<option value="P3">P3 Polish</option>
					</select>
					<button
						type="button"
						onClick={() => void load()}
						className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/87 hover:bg-white/5"
					>
						Refresh
					</button>
				</div>
			</div>

			<div className="px-8 py-6">
				{loading && bugs.length === 0 && (
					<div className="text-sm text-white/50">Loading bug reports…</div>
				)}
				{error && (
					<div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300">
						{error}
					</div>
				)}
				{!loading && !error && bugs.length === 0 && (
					<div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
						No bugs match current filters. Inbox empty 🎉
					</div>
				)}
				{bugs.length > 0 && (
					<div className="space-y-3">
						{bugs.map((bug) => (
							<div
								key={bug.id}
								className="rounded-xl border border-white/10 bg-zinc-900 p-4 hover:border-white/25"
							>
								<div className="mb-2 flex items-start justify-between gap-3">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_META[bug.severity].cls}`}
										>
											{SEVERITY_META[bug.severity].icon}
											{bug.severity}
										</span>
										<span
											className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[bug.status].cls}`}
										>
											{STATUS_META[bug.status].label}
										</span>
										<span className="font-mono text-[10px] text-white/40">
											#{bug.id.slice(0, 8)}
										</span>
									</div>
									<select
										value={bug.status}
										onChange={(e) => void handleStatusChange(bug.id, e.target.value as Status)}
										disabled={updating === bug.id}
										className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] text-white/87 disabled:opacity-50"
									>
										{(Object.keys(STATUS_META) as Status[]).map((s) => (
											<option key={s} value={s}>
												{STATUS_META[s].label}
											</option>
										))}
									</select>
								</div>
								<h3 className="mb-1 text-sm font-medium text-white/87">{bug.title}</h3>
								<p className="text-xs leading-snug text-white/60 line-clamp-3">
									{bug.description}
								</p>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/40">
									<span>Reporter: {bug.reporterId.slice(0, 8)}</span>
									{bug.pageUrl && (
										<span className="font-mono">📍 {new URL(bug.pageUrl).pathname}</span>
									)}
									<span>{new Date(bug.createdAt).toLocaleString("vi-VN")}</span>
									{bug.resolvedAt && (
										<span className="text-green-400">
											✓ Resolved {new Date(bug.resolvedAt).toLocaleDateString("vi-VN")}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}
