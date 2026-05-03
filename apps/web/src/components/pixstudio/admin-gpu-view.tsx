/**
 * Admin GPU view — real wire to /api/admin/gpu/* (Sprint 9 backend).
 *
 * Per docs/preview/06-admin-gpu.html + Sprint 5 backend gpu-spawn.ts.
 * Falls back to stub mode if API unreachable (dev convenience).
 */

"use client";

import { useEffect, useState } from "react";
import { Lock, Power, Square, AlertTriangle, DollarSign, Clock, Cpu, Activity } from "lucide-react";
import { Sidebar } from "./sidebar";
import { apiFetch, type PixStudioUser } from "@/lib/api-client";

interface GpuDroplet {
	id: number;
	ipAddress: string | null;
	status: "new" | "active" | "off" | "archive";
	region: string;
	memoryMb: number;
	createdAt: string;
}

interface ListResponse {
	droplets: GpuDroplet[];
	totalActive: number;
	snapshotId: string;
}

interface AdminGpuViewProps {
	user?: PixStudioUser;
}

const HOURLY_RATE_USD = 1.57;

export function AdminGpuView({ user }: AdminGpuViewProps) {
	const [droplets, setDroplets] = useState<GpuDroplet[]>([]);
	const [snapshotId, setSnapshotId] = useState("226870948");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [confirmStart, setConfirmStart] = useState(false);
	const [confirmStop, setConfirmStop] = useState<GpuDroplet | null>(null);
	const [actionPending, setActionPending] = useState(false);

	const refresh = async () => {
		try {
			const data = await apiFetch<ListResponse>("/api/admin/gpu/list");
			setDroplets(data.droplets);
			setSnapshotId(data.snapshotId);
			setError(null);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to load";
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable closure; adding it would re-create interval every render
	useEffect(() => {
		void refresh();
		const interval = setInterval(() => {
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			void refresh();
		}, 15_000);
		return () => clearInterval(interval);
	}, []);

	const active = droplets.find((d) => d.status === "active");
	const sessionMinutes = active
		? Math.max(0, Math.floor((Date.now() - new Date(active.createdAt).getTime()) / 60000))
		: 0;
	const sessionCost = (sessionMinutes / 60) * HOURLY_RATE_USD;

	const handleSpawn = async () => {
		setActionPending(true);
		try {
			await apiFetch("/api/admin/gpu/spawn", {
				method: "POST",
				body: JSON.stringify({ region: "tor1", size: "gpu-l40sx1-48gb" }),
			});
			setConfirmStart(false);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Spawn failed");
		} finally {
			setActionPending(false);
		}
	};

	const handleDestroy = async (id: number) => {
		setActionPending(true);
		try {
			await apiFetch(`/api/admin/gpu/${id}`, { method: "DELETE" });
			setConfirmStop(null);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Destroy failed");
		} finally {
			setActionPending(false);
		}
	};

	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />

			<main className="flex flex-1 flex-col">
				<div className="px-8 pt-6">
					<div className="mb-2 font-mono text-xs text-white/50">
						Home / Settings / Admin / AI Compute
					</div>
					<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
						AI Compute (GPU)
						<span className="flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-400">
							<Lock className="h-3 w-3" />
							Admin Only
						</span>
					</h1>
					<p className="mt-2 text-sm text-white/50">
						Manual Start/Destroy GPU droplet L40S 48GB TOR1 ({" "}
						<strong className="text-white/87">${HOURLY_RATE_USD}/hr</strong>). SOP timing rules + auto-warning
						thresholds + hard cap failsafe. Snapshot ID:{" "}
						<code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px]">{snapshotId}</code>
					</p>
				</div>

				<div className="px-8 py-6">
					{error && (
						<div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
							{error}
						</div>
					)}

					{/* Status panel */}
					<div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
						<StatusCard
							icon={<Activity className="h-5 w-5" />}
							label="Status"
							primary={loading ? "…" : active ? "Running" : "Stopped"}
							color={active ? "text-green-400" : "text-zinc-400"}
						/>
						<StatusCard
							icon={<Clock className="h-5 w-5" />}
							label="Session time"
							primary={
								active
									? `${Math.floor(sessionMinutes / 60)}h ${sessionMinutes % 60}m`
									: "—"
							}
							color="text-white/87"
						/>
						<StatusCard
							icon={<DollarSign className="h-5 w-5" />}
							label="Session cost"
							primary={`$${sessionCost.toFixed(2)}`}
							color={sessionCost > 5 ? "text-yellow-400" : "text-white/87"}
						/>
					</div>

					{/* Action buttons */}
					<div className="mb-6 flex gap-3">
						{!active ? (
							<button
								onClick={() => setConfirmStart(true)}
								disabled={loading || actionPending}
								className="flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
							>
								<Power className="h-4 w-4" />
								Start GPU droplet
							</button>
						) : (
							<button
								onClick={() => setConfirmStop(active)}
								disabled={actionPending}
								className="flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
							>
								<Square className="h-4 w-4" />
								Destroy droplet (${HOURLY_RATE_USD}/hr stops now)
							</button>
						)}
					</div>

					{/* SOP timing rules */}
					<div className="mb-6 rounded-xl border border-white/10 bg-zinc-900 p-5">
						<h3 className="mb-3 flex items-center gap-2 font-serif text-base text-zinc-300">
							<AlertTriangle className="h-4 w-4 text-yellow-400" />
							SOP timing rules
						</h3>
						<ul className="space-y-2 text-sm text-white/70">
							<li className="flex items-start gap-2">
								<span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
								Khởi động chỉ khi có job Path B đang chờ (defer Sprint 9 — auto via worker)
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
								Cảnh báo nếu chạy &gt; 1h liên tục mà không có active job
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
								Hard cap auto-destroy nếu cost session &gt; $10 (failsafe — em chưa wire)
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
								Region tor1 (Toronto) — closest snapshot. Latency cao Việt Nam (~250ms),
								OK vì pipeline batch không real-time.
							</li>
						</ul>
					</div>

					{/* Snapshot info */}
					<div className="mb-6 rounded-xl border border-white/10 bg-zinc-900 p-5">
						<h3 className="mb-3 flex items-center gap-2 font-serif text-base text-zinc-300">
							<Cpu className="h-4 w-4 text-[#60A5FA]" />
							Snapshot pre-installed
						</h3>
						<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
							{[
								"Whisper-large-v3",
								"Demucs htdemucs_ft",
								"SAM 2",
								"Real-ESRGAN",
								"RIFE",
								"ComfyUI",
								"Chromaprint",
								"PySceneDetect",
							].map((tool) => (
								<div
									key={tool}
									className="rounded border border-white/10 bg-zinc-800 px-2 py-1.5 text-center font-mono text-[11px] text-white/87"
								>
									{tool}
								</div>
							))}
						</div>
					</div>

					{/* Active droplets list */}
					<div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
						<h3 className="mb-3 font-serif text-base text-zinc-300">
							Active droplets ({droplets.length})
						</h3>
						{droplets.length === 0 ? (
							<div className="text-xs text-white/50">No active droplets.</div>
						) : (
							<div className="space-y-2">
								{droplets.map((d) => (
									<div
										key={d.id}
										className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-800 px-3 py-2"
									>
										<div className="font-mono text-xs text-white/87">
											#{d.id} · {d.region} · {d.ipAddress ?? "no-ip"} ·{" "}
											<span className={d.status === "active" ? "text-green-400" : "text-yellow-400"}>
												{d.status}
											</span>
										</div>
										<button
											onClick={() => setConfirmStop(d)}
											disabled={actionPending}
											className="rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
										>
											Destroy
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{confirmStart && (
					<ConfirmModal
						title="Start GPU droplet?"
						message={`Spawn DO L40S 48GB TOR1 từ snapshot ${snapshotId}. Billing $${HOURLY_RATE_USD}/hr starts immediately. Confirm?`}
						confirmLabel={`Start ($${HOURLY_RATE_USD}/hr)`}
						confirmColor="bg-green-600 hover:bg-green-500"
						onCancel={() => setConfirmStart(false)}
						onConfirm={() => void handleSpawn()}
						pending={actionPending}
					/>
				)}

				{confirmStop && (
					<ConfirmModal
						title="Destroy GPU droplet?"
						message={`Droplet #${confirmStop.id}. Destroy stops billing immediately. Confirm?`}
						confirmLabel="Destroy"
						confirmColor="bg-red-600 hover:bg-red-500"
						onCancel={() => setConfirmStop(null)}
						onConfirm={() => void handleDestroy(confirmStop.id)}
						pending={actionPending}
					/>
				)}
			</main>
		</div>
	);
}

function StatusCard({
	icon,
	label,
	primary,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	primary: string;
	color: string;
}) {
	return (
		<div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
				{icon}
				{label}
			</div>
			<div className={`text-2xl font-semibold ${color}`}>{primary}</div>
		</div>
	);
}

function ConfirmModal({
	title,
	message,
	confirmLabel,
	confirmColor,
	onCancel,
	onConfirm,
	pending,
}: {
	title: string;
	message: string;
	confirmLabel: string;
	confirmColor: string;
	onCancel: () => void;
	onConfirm: () => void;
	pending?: boolean;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
			<div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6">
				<h2 className="mb-3 font-serif text-lg text-zinc-300">{title}</h2>
				<p className="mb-5 text-sm text-white/70">{message}</p>
				<div className="flex justify-end gap-2">
					<button
						onClick={onCancel}
						disabled={pending}
						className="rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						disabled={pending}
						className={`rounded-md px-4 py-2 text-sm font-medium text-white ${confirmColor} disabled:opacity-50`}
					>
						{pending ? "Working…" : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
