/**
 * Admin Stock view — fetches /api/admin/stock-accounts (Sprint 5 PR #13 endpoint).
 *
 * Per docs/preview/05-admin-stock.html.
 */

"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle, CheckCircle2, XCircle, Lock } from "lucide-react";
import { Sidebar } from "./sidebar";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "https://pixstudio-api.fly.dev";

interface StockAccount {
	id: string;
	vendor: "ISTOCK" | "ENVATO" | "SHUTTERSTOCK";
	label: string;
	monthlyQuota: number;
	monthlyUsed: number;
	utilizationPct: number;
	resetDayOfMonth: number;
	status: "ACTIVE" | "RATE_LIMITED" | "EXPIRED" | "DISABLED";
	createdAt: string;
}

interface AdminStockViewProps {
	user?: {
		name: string;
		tier: "STANDARD" | "PRO" | "MAX";
		buildsUsed: number;
		buildsLimit: number;
	};
}

const VENDOR_LABELS = {
	ISTOCK: "iStock",
	ENVATO: "Envato",
	SHUTTERSTOCK: "Shutterstock",
};

export function AdminStockView({ user }: AdminStockViewProps) {
	const [accounts, setAccounts] = useState<StockAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAdd, setShowAdd] = useState(false);

	useEffect(() => {
		const fetchAccounts = async () => {
			try {
				const res = await fetch(`${API_BASE}/api/admin/stock-accounts`, {
					credentials: "include",
				});
				if (!res.ok) {
					if (res.status === 401 || res.status === 403) {
						setError("Admin role required. Login với account ADMIN.");
					} else {
						setError(`HTTP ${res.status}`);
					}
					return;
				}
				const data = (await res.json()) as { items: StockAccount[] };
				setAccounts(data.items);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load");
			} finally {
				setLoading(false);
			}
		};
		void fetchAccounts();
	}, []);

	const grouped = accounts.reduce<Record<string, StockAccount[]>>((acc, a) => {
		(acc[a.vendor] = acc[a.vendor] ?? []).push(a);
		return acc;
	}, {});

	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />

			<main className="flex flex-1 flex-col">
				<div className="px-8 pt-6">
					<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Admin</div>
					<div className="flex items-center justify-between">
						<h1 className="flex items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
							Stock Libraries
							<span className="flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-400">
								<Lock className="h-3 w-3" />
								Admin Only
							</span>
						</h1>
						<button
							onClick={() => setShowAdd(true)}
							className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90"
						>
							<Plus className="h-4 w-4" />
							Add account
						</button>
					</div>
					<p className="mt-2 text-sm text-white/50">
						10-20 accounts iStock + Envato + Shutterstock pool. API keys encrypted at rest,
						round-robin quota-aware rotation, per-account audit log.
					</p>
				</div>

				{loading && (
					<div className="px-8 py-12 text-center text-sm text-white/50">Loading...</div>
				)}

				{error && (
					<div className="mx-8 my-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
						<AlertTriangle className="mb-2 h-5 w-5" />
						{error}
					</div>
				)}

				{!loading && !error && accounts.length === 0 && (
					<div className="mx-8 my-6 rounded-lg border border-dashed border-white/10 bg-zinc-900 p-8 text-center text-sm text-white/50">
						Chưa có account nào. Click <strong>Add account</strong> để register account đầu tiên.
					</div>
				)}

				{!loading && Object.keys(grouped).length > 0 && (
					<div className="px-8 pb-12">
						{(["ISTOCK", "ENVATO", "SHUTTERSTOCK"] as const).map((vendor) => {
							const list = grouped[vendor] ?? [];
							if (list.length === 0) return null;
							return (
								<div key={vendor} className="mb-8">
									<h2 className="mb-3 font-serif text-xl text-zinc-300">
										{VENDOR_LABELS[vendor]} ({list.length})
									</h2>
									<div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
										<table className="w-full">
											<thead>
												<tr className="border-b border-white/10">
													<th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/50">
														Label
													</th>
													<th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/50">
														Quota
													</th>
													<th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/50">
														Used
													</th>
													<th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/50">
														Reset Day
													</th>
													<th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/50">
														Status
													</th>
												</tr>
											</thead>
											<tbody>
												{list.map((a) => (
													<tr
														key={a.id}
														className="border-b border-white/5 last:border-b-0 hover:bg-white/5"
													>
														<td className="px-3 py-3 text-sm text-white/87">{a.label}</td>
														<td className="px-3 py-3 text-sm text-white/87">
															{a.monthlyQuota.toLocaleString()}
														</td>
														<td className="px-3 py-3 text-sm">
															<div className="flex items-center gap-2">
																<span
																	className={
																		a.utilizationPct > 90
																			? "text-red-400"
																			: a.utilizationPct > 70
																				? "text-yellow-400"
																				: "text-white/87"
																	}
																>
																	{a.monthlyUsed.toLocaleString()} ({a.utilizationPct}%)
																</span>
																<div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
																	<div
																		className={`h-full ${
																			a.utilizationPct > 90
																				? "bg-red-500"
																				: a.utilizationPct > 70
																					? "bg-yellow-500"
																					: "bg-[#3B82F6]"
																		}`}
																		style={{ width: `${Math.min(100, a.utilizationPct)}%` }}
																	/>
																</div>
															</div>
														</td>
														<td className="px-3 py-3 text-sm text-white/87">
															{a.resetDayOfMonth} hàng tháng
														</td>
														<td className="px-3 py-3">
															<StatusBadge status={a.status} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
			</main>
		</div>
	);
}

function StatusBadge({ status }: { status: StockAccount["status"] }) {
	const map = {
		ACTIVE: {
			icon: <CheckCircle2 className="h-3 w-3" />,
			label: "Active",
			cls: "bg-green-500/10 text-green-400 border-green-500/30",
		},
		RATE_LIMITED: {
			icon: <AlertTriangle className="h-3 w-3" />,
			label: "Throttle",
			cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
		},
		EXPIRED: {
			icon: <XCircle className="h-3 w-3" />,
			label: "Expired",
			cls: "bg-red-500/10 text-red-400 border-red-500/30",
		},
		DISABLED: {
			icon: <XCircle className="h-3 w-3" />,
			label: "Disabled",
			cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
		},
	}[status];

	return (
		<span
			className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] ${map.cls}`}
		>
			{map.icon}
			{map.label}
		</span>
	);
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
	const [vendor, setVendor] = useState<"ISTOCK" | "ENVATO" | "SHUTTERSTOCK">("ISTOCK");
	const [label, setLabel] = useState("");
	const [monthlyQuota, setMonthlyQuota] = useState(1000);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/api/admin/stock-accounts`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					vendor,
					label,
					apiCredentialsKey: `tmp-${Date.now()}`, // placeholder — real upload via R2 presigned
					monthlyQuota,
					resetDayOfMonth: 1,
				}),
			});
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errBody.error ?? `HTTP ${res.status}`);
			}
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add");
			setSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
			<div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6">
				<h2 className="mb-4 font-serif text-lg text-zinc-300">Add stock account</h2>
				<div className="space-y-3">
					<div>
						<label className="mb-1 block text-xs font-medium text-white/50">Vendor</label>
						<div className="flex gap-2">
							{(["ISTOCK", "ENVATO", "SHUTTERSTOCK"] as const).map((v) => (
								<button
									key={v}
									onClick={() => setVendor(v)}
									className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
										vendor === v
											? "bg-[#3B82F6] text-white"
											: "border border-white/10 bg-zinc-800 text-white/87 hover:bg-zinc-700"
									}`}
								>
									{VENDOR_LABELS[v]}
								</button>
							))}
						</div>
					</div>
					<div>
						<label className="mb-1 block text-xs font-medium text-white/50">Label</label>
						<input
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							placeholder="e.g. iStock-Account-3"
							className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87 placeholder-white/40"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs font-medium text-white/50">Monthly quota</label>
						<input
							type="number"
							value={monthlyQuota}
							onChange={(e) => setMonthlyQuota(Number(e.target.value))}
							className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87"
						/>
					</div>
					{error && (
						<div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
					)}
				</div>
				<div className="mt-4 flex justify-end gap-2">
					<button
						onClick={onClose}
						className="rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={!label.trim() || submitting}
						className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
					>
						{submitting ? "Adding..." : "Add account"}
					</button>
				</div>
			</div>
		</div>
	);
}
