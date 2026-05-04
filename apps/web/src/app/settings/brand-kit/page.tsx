/**
 * Brand Kit settings page — workspace branding form (Pro+ tier).
 *
 * Wires to /api/workspaces/:id/brand-kit GET + PUT endpoints (Sprint 3).
 * Pro+ tier gate enforced server-side; UI shows upgrade prompt on 402.
 */

"use client";

import { useEffect, useState } from "react";
import { Palette, Save, Lock, Loader2 } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { apiFetch } from "@/lib/api-client";
import { useAuthUser } from "@/hooks/use-auth-user";

interface BrandKitData {
	id: string;
	workspaceId: string;
	primaryColor: string;
	secondaryColor: string | null;
	accentColor: string | null;
	fontFamily: string | null;
	watermarkText: string | null;
	watermarkOn: boolean;
	logoR2Key: string | null;
	faviconR2Key: string | null;
}

interface WorkspaceRow {
	id: string;
	name: string;
}

const DEFAULT_KIT: Omit<BrandKitData, "id" | "workspaceId"> = {
	primaryColor: "#3B82F6",
	secondaryColor: null,
	accentColor: null,
	fontFamily: "Inter",
	watermarkText: null,
	watermarkOn: true,
	logoR2Key: null,
	faviconR2Key: null,
};

export default function BrandKitPage() {
	const { user } = useAuthUser();
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);
	const [workspaceName, setWorkspaceName] = useState<string>("");
	const [kit, setKit] = useState<typeof DEFAULT_KIT>(DEFAULT_KIT);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
				const first = ws.items[0];
				if (!first) {
					setError("Chưa có workspace — anh tạo workspace trước");
					return;
				}
				setWorkspaceId(first.id);
				setWorkspaceName(first.name);
				const data = await apiFetch<{
					brandKit: BrandKitData | null;
					defaults: typeof DEFAULT_KIT | null;
				}>(`/api/workspaces/${first.id}/brand-kit`);
				if (data.brandKit) {
					setKit({
						primaryColor: data.brandKit.primaryColor,
						secondaryColor: data.brandKit.secondaryColor,
						accentColor: data.brandKit.accentColor,
						fontFamily: data.brandKit.fontFamily,
						watermarkText: data.brandKit.watermarkText,
						watermarkOn: data.brandKit.watermarkOn,
						logoR2Key: data.brandKit.logoR2Key,
						faviconR2Key: data.brandKit.faviconR2Key,
					});
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg.includes("401") || msg.includes("Unauthorized") ? "Đăng nhập để truy cập" : msg);
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const handleSave = async () => {
		if (!workspaceId) return;
		setSaving(true);
		setError(null);
		try {
			await apiFetch(`/api/workspaces/${workspaceId}/brand-kit`, {
				method: "PUT",
				body: JSON.stringify(kit),
			});
			setSavedAt(new Date().toLocaleTimeString("vi-VN"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Save failed";
			setError(
				msg.includes("402") || msg.includes("Pro tier")
					? "Brand Kit yêu cầu Pro tier. Upgrade workspace để mở chỉnh sửa."
					: msg,
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<PageShell user={user}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Settings / Brand Kit</div>
				<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
					<Palette className="h-7 w-7 text-[#60A5FA]" />
					Brand Kit
					<span className="flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
						<Lock className="h-3 w-3" />
						Pro+ tier
					</span>
				</h1>
				<p className="mt-1.5 text-sm text-white/50">
					Logo · màu sắc · font · watermark cho workspace{" "}
					<strong className="text-white/87">{workspaceName || "..."}</strong>
				</p>
			</div>

			<div className="mx-auto w-full max-w-2xl px-8 py-8">
				{loading ? (
					<div className="text-sm text-white/50">Loading…</div>
				) : error ? (
					<div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300">
						{error}
					</div>
				) : (
					<div className="space-y-5">
						{/* Colors */}
						<section className="rounded-xl border border-white/10 bg-zinc-900 p-5">
							<h2 className="mb-3 font-serif text-base text-zinc-300">Colors</h2>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<ColorInput
									label="Primary"
									value={kit.primaryColor}
									onChange={(v) => setKit({ ...kit, primaryColor: v })}
								/>
								<ColorInput
									label="Secondary"
									value={kit.secondaryColor ?? ""}
									onChange={(v) => setKit({ ...kit, secondaryColor: v || null })}
									nullable
								/>
								<ColorInput
									label="Accent"
									value={kit.accentColor ?? ""}
									onChange={(v) => setKit({ ...kit, accentColor: v || null })}
									nullable
								/>
							</div>
						</section>

						{/* Font + Watermark */}
						<section className="rounded-xl border border-white/10 bg-zinc-900 p-5">
							<h2 className="mb-3 font-serif text-base text-zinc-300">Typography & watermark</h2>
							<div className="space-y-3">
								<div>
									<label className="mb-1 block text-xs font-medium text-white/70">
										Font family
									</label>
									<input
										type="text"
										value={kit.fontFamily ?? ""}
										onChange={(e) => setKit({ ...kit, fontFamily: e.target.value || null })}
										placeholder="Inter / Roboto / Montserrat"
										className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87"
									/>
								</div>
								<div className="flex items-center gap-3">
									<label className="text-xs font-medium text-white/70">Watermark on</label>
									<input
										type="checkbox"
										checked={kit.watermarkOn}
										onChange={(e) => setKit({ ...kit, watermarkOn: e.target.checked })}
										className="h-4 w-4 rounded border-white/10 bg-zinc-800"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-white/70">
										Watermark text (default: PXL-XXXXX)
									</label>
									<input
										type="text"
										value={kit.watermarkText ?? ""}
										onChange={(e) => setKit({ ...kit, watermarkText: e.target.value || null })}
										placeholder="PXL-MINH"
										maxLength={50}
										className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87"
										disabled={!kit.watermarkOn}
									/>
								</div>
							</div>
						</section>

						{/* Logo (placeholder for upload — uses /logo-presign endpoint) */}
						<section className="rounded-xl border border-white/10 bg-zinc-900 p-5">
							<h2 className="mb-3 font-serif text-base text-zinc-300">Logo</h2>
							<p className="text-xs text-white/50">
								R2 logo upload via presigned PUT — UI shipping next sprint. Hiện tại
								logo dùng mặc định PXL gradient.
							</p>
							{kit.logoR2Key && (
								<p className="mt-2 font-mono text-[10px] text-white/40">
									Current: {kit.logoR2Key}
								</p>
							)}
						</section>

						{/* Save */}
						<div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
							<div className="text-xs text-white/50">
								{savedAt && <span className="text-green-400">✓ Saved at {savedAt}</span>}
							</div>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
							>
								{saving ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Saving…
									</>
								) : (
									<>
										<Save className="h-4 w-4" />
										Save brand kit
									</>
								)}
							</button>
						</div>
					</div>
				)}
			</div>
		</PageShell>
	);
}

function ColorInput({
	label,
	value,
	onChange,
	nullable,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	nullable?: boolean;
}) {
	const display = value || "#000000";
	return (
		<div>
			<label className="mb-1 block text-xs font-medium text-white/70">{label}</label>
			<div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-800 px-2 py-1.5">
				<input
					type="color"
					value={display}
					onChange={(e) => onChange(e.target.value)}
					className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
				/>
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={nullable ? "(none)" : "#3B82F6"}
					className="w-full bg-transparent font-mono text-xs text-white/87 outline-none"
				/>
			</div>
		</div>
	);
}
