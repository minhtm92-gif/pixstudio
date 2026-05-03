/**
 * PixStudio Sidebar — shared across Dashboard / Projects / Asset Studio / etc.
 *
 * Per docs/preview/01-dashboard.html design.
 * 260px width, dark elevated background, logo + nav + credits + user card.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Home,
	FolderOpen,
	Package,
	LayoutGrid,
	User,
	Settings,
	Palette,
	BarChart3,
	Bug,
	HardDrive,
	Cpu,
	Mic,
} from "lucide-react";
import type { PixStudioUser } from "@/lib/api-client";

interface SidebarProps {
	user?: PixStudioUser;
}

const NAV_ITEMS = [
	{ href: "/", label: "Home", icon: <Home className="h-4 w-4" /> },
	{ href: "/projects", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
	{ href: "/assets", label: "Asset Studio", icon: <Package className="h-4 w-4" /> },
	{ href: "/templates", label: "Templates", icon: <LayoutGrid className="h-4 w-4" /> },
	{ href: "/account", label: "You", icon: <User className="h-4 w-4" /> },
];

const SETTINGS_NAV_ITEMS = [
	{ href: "/settings/brand-kit", label: "Brand Kit", icon: <Palette className="h-4 w-4" /> },
	{ href: "/settings/voices", label: "Voices", icon: <Mic className="h-4 w-4" /> },
];

const ADMIN_NAV_ITEMS = [
	{ href: "/admin/kpi", label: "KPI Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
	{ href: "/admin/bug-reports", label: "Bug Reports", icon: <Bug className="h-4 w-4" /> },
	{ href: "/admin/stock", label: "Stock Library", icon: <HardDrive className="h-4 w-4" /> },
	{ href: "/admin/music", label: "Music Library", icon: <Mic className="h-4 w-4" /> },
	{ href: "/admin/gpu", label: "AI Compute", icon: <Cpu className="h-4 w-4" /> },
];

const TIER_COLOR_MAP = {
	STANDARD: "text-muted-foreground",
	PRO: "text-blue-400",
	MAX: "text-yellow-400",
} as const;

export function Sidebar({ user }: SidebarProps) {
	const pathname = usePathname();
	const tierColor = TIER_COLOR_MAP[user?.tier ?? "STANDARD"];

	const quotaPct = user
		? Math.min(100, Math.round((user.buildsUsed / Math.max(1, user.buildsLimit)) * 100))
		: 0;

	return (
		<aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#0c0c0e]">
			<div className="px-3 pt-4">
				{/* Logo */}
				<Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3DA8F5] via-[#3B82F6] to-[#1E40AF] font-serif text-sm font-semibold text-white">
						P
					</div>
					<span className="font-serif text-base text-zinc-300">PixStudio</span>
					<span className="ml-auto rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
						v1.0
					</span>
				</Link>

				{/* Nav */}
				<nav className="flex flex-col gap-0.5">
					{NAV_ITEMS.map((item) => {
						const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors ${
									active
										? "bg-white/10 text-white"
										: "text-white/60 hover:bg-white/5 hover:text-white"
								}`}
							>
								{item.icon}
								<span>{item.label}</span>
							</Link>
						);
					})}
				</nav>

				{/* Settings group */}
				<div className="mt-5">
					<div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
						Settings
					</div>
					<nav className="flex flex-col gap-0.5">
						{SETTINGS_NAV_ITEMS.map((item) => {
							const active = pathname?.startsWith(item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors ${
										active
											? "bg-white/10 text-white"
											: "text-white/60 hover:bg-white/5 hover:text-white"
									}`}
								>
									{item.icon}
									<span>{item.label}</span>
								</Link>
							);
						})}
					</nav>
				</div>

				{/* Admin group — visible to all but pages gate at server */}
				<div className="mt-5">
					<div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-500/60">
						Admin
					</div>
					<nav className="flex flex-col gap-0.5">
						{ADMIN_NAV_ITEMS.map((item) => {
							const active = pathname?.startsWith(item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors ${
										active
											? "bg-white/10 text-white"
											: "text-white/60 hover:bg-white/5 hover:text-white"
									}`}
								>
									{item.icon}
									<span>{item.label}</span>
								</Link>
							);
						})}
					</nav>
				</div>
			</div>

			{/* Bottom: credits + user card */}
			<div className="mt-auto border-t border-white/10 p-3">
				{user && (
					<>
						<div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
							<span>
								Quota: {user.buildsUsed}/{user.buildsLimit === -1 ? "∞" : user.buildsLimit}{" "}
								video
							</span>
							{user.buildsLimit > 0 && (
								<div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-900">
									<div
										className="h-full bg-[#3B82F6]"
										style={{ width: `${quotaPct}%` }}
									/>
								</div>
							)}
						</div>
						<Link
							href="/account"
							className="mt-2 flex cursor-pointer items-center gap-2.5 rounded p-2 hover:bg-white/5"
							title="Mở Account settings"
						>
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-xs font-semibold text-white">
								{user.name[0]?.toUpperCase()}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-xs font-medium text-white/87">
									{user.name}
								</div>
								<div className={`text-[10px] ${tierColor}`}>{user.tier} tier</div>
							</div>
							<Settings className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-white" />
						</Link>
					</>
				)}
			</div>
		</aside>
	);
}
