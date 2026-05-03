/**
 * Dashboard View — entry page after login.
 *
 * Per docs/preview/01-dashboard.html.
 * Layout: Sidebar (260px) + Main (Mode toggle + Hero textarea + Sections)
 *
 * Sections:
 *   1. Generative models — 7 vendors locked (Seedance / Veo3 / Kling / Nano Banana Pro/Std / Seedream / DreamActor)
 *   2. AI Tools — Templates / Characters / Music / Brand Kit
 *   3. Agents — Phase 4+ placeholder
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Sparkles, ChevronRight, Image as ImageIcon, Music, Layout, User as UserIcon } from "lucide-react";
import { Sidebar } from "./sidebar";
import type { PixStudioUser } from "@/lib/api-client";

type Mode = "pro" | "quick";
type Section = "models" | "projects" | "trends" | "workflows" | "explore";

const VENDORS = [
	{
		id: "seedance-2-0",
		name: "Seedance 2.0",
		vendor: "Byteplus",
		tag: "4 modal · reference cap. · 4-15s · primary I2V/T2V",
		badge: "⭐ Đối tác",
		badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
		gradient: "from-blue-900 via-purple-700 to-orange-700",
	},
	{
		id: "veo-3",
		name: "Veo 3",
		vendor: "Google",
		tag: "Text-to-video premium · audio native · Max tier",
		badge: "Gemini API",
		badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500",
		gradient: "from-cyan-700 via-blue-600 to-indigo-900",
	},
	{
		id: "kling-3-0",
		name: "Kling 3.0",
		vendor: "fal.ai",
		tag: "Transition vendor · creator quen Kling opt-in · quota nhỏ",
		badge: "fal.ai",
		badgeClass: "bg-white/10 text-zinc-400 border-white/20",
		gradient: "from-pink-700 via-rose-600 to-orange-600",
	},
	{
		id: "nano-banana-pro",
		name: "Nano Banana Pro",
		vendor: "Google",
		tag: "Image gen premium · 4K · Pro/Max tier",
		badge: "Gemini API",
		badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500",
		gradient: "from-amber-700 via-orange-600 to-red-700",
	},
	{
		id: "nano-banana-std",
		name: "Nano Banana",
		vendor: "Google",
		tag: "Image gen standard · default tier",
		badge: "Gemini API",
		badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500",
		gradient: "from-emerald-700 via-teal-600 to-cyan-700",
	},
	{
		id: "seedream",
		name: "Seedream",
		vendor: "Byteplus",
		tag: "Realistic image + avatar (non-real-human)",
		badge: "⭐ Đối tác",
		badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
		gradient: "from-fuchsia-700 via-pink-600 to-rose-700",
	},
	{
		id: "dreamactor",
		name: "DreamActor",
		vendor: "Byteplus",
		tag: "Real-human clone option · creator chọn khi cần",
		badge: "Byteplus",
		badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500",
		gradient: "from-yellow-700 via-amber-600 to-orange-700",
	},
];

const AI_TOOLS = [
	{ name: "Templates", icon: <Layout className="h-5 w-5" />, desc: "Theo platform × purpose × cultural VN (Tết, Trung Thu)" },
	{ name: "Characters", icon: <UserIcon className="h-5 w-5" />, desc: "Seedream avatar + DreamActor option (không watermark)" },
	{ name: "Music", icon: <Music className="h-5 w-5" />, desc: "Stock pool admin · ElevenLabs SFX + TTS VN" },
	{ name: "Brand Kit", icon: <ImageIcon className="h-5 w-5" />, desc: "Logo · fonts · colors · intro/outro template" },
];

const FEATURED_CHIPS: Array<{ label: string; href: string }> = [
	{ label: "📝 Edit project mới", href: "/projects" },
	{ label: "⚡ Quick Create", href: "/quick-create" },
	{ label: "📚 Browse Templates", href: "/quick-create/workflows" },
	{ label: "🎬 Tạo video Tết", href: "/quick-create?prompt=Video+T%E1%BA%BFt+9%3A16+30s+m%C3%A0u+%C4%91%E1%BB%8F+v%C3%A0ng+truy%E1%BB%81n+th%E1%BB%91ng" },
	{ label: "👤 Tạo Character", href: "/assets" },
];

interface DashboardViewProps {
	user?: PixStudioUser;
}

export function DashboardView({ user }: DashboardViewProps) {
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("pro");
	const [section, setSection] = useState<Section>("models");
	const [prompt, setPrompt] = useState("");

	const handleSubmit = () => {
		if (!prompt.trim()) return;
		if (mode === "quick") {
			// Pre-fill Quick Create hero with prompt
			router.push(`/quick-create?prompt=${encodeURIComponent(prompt)}`);
		} else {
			// Pro Workspace: nav to projects list (Sprint 9 wires real "create + open editor")
			// The /projects page (OpenCut inherited) shows project list with create flow.
			router.push(`/projects?prompt=${encodeURIComponent(prompt)}`);
		}
	};

	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />

			<main className="flex flex-1 flex-col overflow-x-hidden">
				{/* Top bar */}
				<div className="flex items-center justify-end gap-3 px-7 py-3.5">
					<button
						type="button"
						onClick={() => router.push("/account")}
						className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white/87 hover:bg-zinc-700"
					>
						⚡ Tăng tier
					</button>
					{user && (
						<button
							type="button"
							onClick={() => router.push("/account")}
							className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-xs font-semibold text-white hover:opacity-90"
							title={`${user.name} (${user.tier} tier) — Account settings`}
						>
							{user.name[0]?.toUpperCase()}
						</button>
					)}
				</div>

				<div className="mx-auto w-full max-w-[880px] px-8 pb-20 pt-6">
					{/* Mode toggle */}
					<div className="mb-8 flex justify-center">
						<div className="flex gap-1.5 rounded-full border border-white/10 bg-zinc-900/50 p-1">
							<button
								onClick={() => setMode("pro")}
								className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
									mode === "pro"
										? "bg-zinc-800 text-white"
										: "text-white/50 hover:text-white"
								}`}
							>
								Pro Workspace
							</button>
							<button
								onClick={() => setMode("quick")}
								className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
									mode === "quick"
										? "bg-zinc-800 text-white"
										: "text-white/50 hover:text-white"
								}`}
							>
								Quick Create
							</button>
						</div>
					</div>

					{/* Hero */}
					<div className="mb-9 text-center">
						<h1 className="mb-3 font-serif text-5xl font-normal leading-tight text-zinc-300">
							Lên ý tưởng — sinh kịch bản — render video
							<span className="ml-3 inline-block rounded border border-white/25 px-2 py-0.5 align-middle font-mono text-xs text-white/50">
								v1.0
							</span>
						</h1>
						<p className="text-base text-white/50">
							Một dòng prompt, PixStudio Agent lo phần còn lại. Editor mở project có sẵn,
							Creator tạo nháp 60s nhanh.
						</p>
					</div>

					{/* Hero input */}
					<div className="relative mb-5">
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder={
								mode === "quick"
									? "Cho em chủ đề + ngôn ngữ... ví dụ: làm reel 30s quảng cáo serum cho phụ nữ 30+, hook 3s đầu nhấn lợi ích chống lão hóa"
									: "Lên kịch bản, storyboard hoặc video... ví dụ: làm reel 30s quảng cáo quần co giãn cho senior 50+, tone ấm áp, hook 3s đầu nhấn vấn đề đau lưng"
							}
							className="min-h-[140px] w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-5 pb-14 pt-4.5 text-base text-white/87 placeholder-white/50 focus:border-[#3B82F6] focus:outline-none"
						/>
						<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
							<button
								className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
								title="Đính kèm file"
							>
								<Plus className="h-4 w-4" />
							</button>
							<button
								onClick={handleSubmit}
								disabled={!prompt.trim()}
								className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
								title="Gửi"
							>
								<Send className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Featured chips */}
					<div className="mb-12 flex flex-wrap items-center gap-2">
						<span className="mr-1 text-xs text-white/50">Đề xuất</span>
						{FEATURED_CHIPS.map((chip) => (
							<button
								key={chip.href}
								type="button"
								onClick={() => router.push(chip.href)}
								className="rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white/87 hover:border-white/25 hover:bg-zinc-800"
							>
								{chip.label}
							</button>
						))}
					</div>

					{/* Section tabs */}
					<div className="mb-6 flex w-fit gap-1.5 rounded-full border border-white/10 bg-zinc-900/50 p-1">
						{(["models", "projects", "trends", "workflows", "explore"] as Section[]).map((s) => (
							<button
								key={s}
								onClick={() => setSection(s)}
								className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
									section === s
										? "bg-zinc-800 text-white"
										: "text-white/50 hover:text-white"
								}`}
							>
								{s === "models"
									? "Models & Vendors"
									: s === "projects"
										? "Projects"
										: s === "trends"
											? "Trends"
											: s === "workflows"
												? "Workflows"
												: "Explore"}
							</button>
						))}
					</div>

					{/* Generative models carousel */}
					{section === "models" && (
						<section className="mb-12">
							<div className="mb-4 flex items-baseline justify-between">
								<div>
									<h2 className="font-serif text-xl text-zinc-300">Generative models</h2>
									<span className="ml-3 text-xs text-white/50">
										7 vendor locked theo scope-01 — không tự ý mở rộng
									</span>
								</div>
								<button className="flex items-center gap-1 text-xs text-white/50 hover:text-white">
									Xem hết <ChevronRight className="h-3 w-3" />
								</button>
							</div>
							<div className="flex gap-3 overflow-x-auto pb-2">
								{VENDORS.map((v) => (
									<div
										key={v.id}
										className={`relative aspect-[16/10] w-60 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br ${v.gradient} transition-transform hover:-translate-y-0.5`}
									>
										<span
											className={`absolute left-2.5 top-2.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${v.badgeClass}`}
										>
											{v.badge}
										</span>
										<div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4">
											<div className="font-serif text-xl font-semibold uppercase tracking-wide text-white">
												{v.name}
											</div>
											<div className="mt-1 text-[11px] leading-tight text-white/75">
												{v.tag}
											</div>
										</div>
									</div>
								))}
							</div>
						</section>
					)}

					{/* AI Tools */}
					<section className="mb-12">
						<div className="mb-4 flex items-baseline justify-between">
							<div>
								<h2 className="font-serif text-xl text-zinc-300">AI Tools</h2>
								<span className="ml-3 text-xs text-white/50">Đẩy nhanh việc tay của Editor</span>
							</div>
							<button className="flex items-center gap-1 text-xs text-white/50 hover:text-white">
								Xem hết <ChevronRight className="h-3 w-3" />
							</button>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{AI_TOOLS.map((tool) => (
								<div
									key={tool.name}
									className="cursor-pointer rounded-xl border border-white/10 bg-zinc-900 p-4 transition-colors hover:border-[#3B82F6]"
								>
									<div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#60A5FA]">
										{tool.icon}
									</div>
									<div className="mb-1 text-sm font-medium text-white/87">{tool.name}</div>
									<div className="text-xs leading-snug text-white/50">{tool.desc}</div>
								</div>
							))}
						</div>
					</section>

					{/* Agents placeholder */}
					<section className="mb-12">
						<div className="mb-4 flex items-baseline justify-between">
							<div>
								<h2 className="font-serif text-xl text-zinc-300">Agents</h2>
								<span className="ml-3 text-xs text-white/50">Phase 4+ — chưa khởi động</span>
							</div>
						</div>
						<div className="rounded-xl border border-dashed border-white/10 bg-zinc-900 p-8 text-center text-xs text-white/50">
							<Sparkles className="mx-auto mb-2 h-5 w-5" />
							Agent layer (chat helper context-aware timeline) sẽ ship Phase 4. Hiện tại
							Brainstorm panel đã có trong Pro Workspace.
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
