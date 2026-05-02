/**
 * Asset Studio — 5 tab library + federated search.
 *
 * Per docs/preview/04-asset-studio.html.
 * Sources: Uploaded / Stock pool admin / AI gen / Crossian RAG (background)
 */

"use client";

import { useState } from "react";
import { Search, Upload, Sparkles, Film, Image as ImageIcon, User as UserIcon, Music as MusicIcon, FileText } from "lucide-react";
import { Sidebar } from "./sidebar";

type Tab = "video" | "image" | "character" | "music" | "script";
type SourceFilter = "all" | "uploaded" | "stock" | "ai-gen" | "crossian";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number }> = [
	{ id: "video", label: "Video", icon: <Film className="h-4 w-4" />, count: 128 },
	{ id: "image", label: "Image", icon: <ImageIcon className="h-4 w-4" />, count: 412 },
	{ id: "character", label: "Character", icon: <UserIcon className="h-4 w-4" />, count: 8 },
	{ id: "music", label: "Music", icon: <MusicIcon className="h-4 w-4" />, count: 76 },
	{ id: "script", label: "Script & Templates", icon: <FileText className="h-4 w-4" />, count: 23 },
];

interface AssetStudioViewProps {
	user?: {
		name: string;
		tier: "STANDARD" | "PRO" | "MAX";
		buildsUsed: number;
		buildsLimit: number;
	};
}

export function AssetStudioView({ user }: AssetStudioViewProps) {
	const [tab, setTab] = useState<Tab>("video");
	const [source, setSource] = useState<SourceFilter>("all");
	const [search, setSearch] = useState("");

	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />

			<main className="flex flex-1 flex-col">
				{/* Header */}
				<div className="px-8 pt-6">
					<div className="mb-2 font-mono text-xs text-white/50">Home / Asset Studio</div>
					<h1 className="font-serif text-3xl font-normal text-zinc-300">Asset Studio</h1>
					<p className="mt-1.5 text-sm text-white/50">
						5 thư viện gộp một nơi: stock + uploaded + AI gen + Crossian RAG. Quota:{" "}
						<strong className="text-white/87">
							{user?.buildsUsed ?? 0}/{user?.buildsLimit === -1 ? "∞" : user?.buildsLimit ?? 0} video gen tháng này
						</strong>{" "}
						({user?.tier} tier).
					</p>
				</div>

				{/* Tabs */}
				<div className="mt-6 flex gap-1 border-b border-white/10 px-8">
					{TABS.map((t) => (
						<button
							key={t.id}
							onClick={() => setTab(t.id)}
							className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
								tab === t.id
									? "border-[#3B82F6] font-medium text-white"
									: "border-transparent text-white/50 hover:text-white"
							}`}
						>
							{t.icon}
							{t.label}
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] ${
									tab === t.id ? "bg-[#3B82F6]/15 text-[#60A5FA]" : "bg-zinc-900 text-white/50"
								}`}
							>
								{t.count}
							</span>
						</button>
					))}
				</div>

				{/* Toolbar */}
				<div className="flex flex-wrap items-center gap-3 px-8 py-4">
					<div className="flex flex-1 items-center gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 py-2">
						<Search className="h-4 w-4 text-white/50" />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Tìm trong tất cả nguồn (uploaded, stock pool, AI gen)..."
							className="flex-1 bg-transparent text-sm text-white/87 placeholder-white/50 outline-none"
						/>
					</div>
					<button className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white/87 hover:bg-zinc-800">
						Aspect: 9:16 ▾
					</button>
					<button className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white/87 hover:bg-zinc-800">
						Duration: bất kỳ ▾
					</button>
					<button className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white/87 hover:bg-zinc-800">
						<Upload className="h-3.5 w-3.5" />
						Upload
					</button>
				</div>

				{/* Source filter chips */}
				<div className="flex flex-wrap gap-1.5 px-8 pb-4">
					<button
						onClick={() => setSource("all")}
						className={`rounded-full px-3 py-1 text-xs transition-colors ${
							source === "all"
								? "bg-[#3B82F6] text-white"
								: "border border-white/10 bg-zinc-900 text-white/87 hover:bg-zinc-800"
						}`}
					>
						Tất cả nguồn
					</button>
					<button
						onClick={() => setSource("uploaded")}
						className={`rounded-full px-3 py-1 text-xs transition-colors ${
							source === "uploaded"
								? "bg-[#3B82F6] text-white"
								: "border border-white/10 bg-zinc-900 text-white/87 hover:bg-zinc-800"
						}`}
					>
						📤 Uploaded
					</button>
					<button
						onClick={() => setSource("stock")}
						className={`rounded-full px-3 py-1 text-xs transition-colors ${
							source === "stock"
								? "bg-[#3B82F6] text-white"
								: "border border-white/10 bg-zinc-900 text-white/87 hover:bg-zinc-800"
						}`}
					>
						🏛️ Stock Pool 👑
					</button>
					<button
						onClick={() => setSource("ai-gen")}
						className={`rounded-full px-3 py-1 text-xs transition-colors ${
							source === "ai-gen"
								? "bg-[#3B82F6] text-white"
								: "border border-white/10 bg-zinc-900 text-white/87 hover:bg-zinc-800"
						}`}
					>
						✨ AI Generated
					</button>
				</div>

				{/* Asset grid */}
				<div className="px-8 pb-24">
					{tab === "video" || tab === "image" || tab === "character" ? (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{Array.from({ length: 18 }).map((_, i) => {
								const aspect = tab === "image" ? "aspect-square" : "aspect-[9/16]";
								const colors = [
									"from-blue-700 via-purple-600 to-pink-700",
									"from-emerald-700 via-cyan-600 to-blue-700",
									"from-amber-700 via-orange-600 to-red-700",
									"from-rose-700 via-pink-600 to-purple-700",
									"from-indigo-700 via-blue-600 to-cyan-700",
									"from-yellow-700 via-amber-600 to-orange-700",
								];
								const color = colors[i % colors.length];
								const sourceLabels = ["📤 Uploaded", "🏛️ iStock", "✨ AI gen", "🏛️ Envato"];
								const sourceLabel = sourceLabels[i % 4];
								return (
									<div
										key={i}
										className={`group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br ${color} ${aspect} transition-all hover:-translate-y-0.5 hover:shadow-2xl`}
									>
										<span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
											{sourceLabel}
										</span>
										<span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
											{tab === "video" ? "30s" : tab === "image" ? "1080×1080" : "char"}
										</span>
										<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-2.5">
											<div className="truncate text-xs font-medium text-white">
												{tab === "video" && `clip-${i + 1}.mp4`}
												{tab === "image" && `image-${i + 1}.png`}
												{tab === "character" && `Character ${i + 1}`}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : tab === "music" ? (
						<div className="space-y-2">
							{Array.from({ length: 12 }).map((_, i) => (
								<div
									key={i}
									className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 p-3 hover:bg-zinc-800"
								>
									<button className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-[#3B82F6]/20">
										<MusicIcon className="h-4 w-4" />
									</button>
									<div className="flex-1">
										<div className="text-sm font-medium text-white/87">Track {i + 1}</div>
										<div className="text-[11px] text-white/50">
											{["FB Sound Collection", "TikTok CC", "YT Audio Library"][i % 3]} ·{" "}
											{["Pop", "Lo-fi", "Cinematic"][i % 3]} · {120 + i * 5}s
										</div>
									</div>
									<button className="rounded border border-white/10 px-3 py-1 text-xs text-white/87 hover:bg-white/5">
										Use
									</button>
								</div>
							))}
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{Array.from({ length: 9 }).map((_, i) => (
								<div
									key={i}
									className="cursor-pointer rounded-lg border border-white/10 bg-zinc-900 p-4 hover:border-[#3B82F6]"
								>
									<div className="mb-2 flex items-center gap-2">
										<FileText className="h-4 w-4 text-[#60A5FA]" />
										<span className="text-sm font-medium text-white/87">
											Template {i + 1}
										</span>
									</div>
									<p className="text-xs leading-snug text-white/50">
										UC {(i % 4) + 1} sample script · 30s · 9:16 · UGC review style
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Generate FAB */}
				<button className="fixed bottom-8 right-8 z-30 flex items-center gap-2 rounded-full bg-[#3B82F6] px-5 py-3.5 text-sm font-medium text-white shadow-lg shadow-[#3B82F6]/40 hover:bg-[#3B82F6]/90">
					<Sparkles className="h-4 w-4" />
					AI Generate
				</button>
			</main>
		</div>
	);
}
