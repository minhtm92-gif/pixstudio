/**
 * Account page — Phase 1 stub showing tier + usage + sign-out CTA.
 *
 * Full account settings (avatar, password change, sessions, billing) ship Phase 2.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User as UserIcon, LogOut, Settings, CreditCard } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { apiFetch, type PixStudioUser } from "@/lib/api-client";

interface SessionResponse {
	user: { id: string; email: string; name?: string };
}

export default function AccountPage() {
	const [user, setUser] = useState<PixStudioUser | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const load = async () => {
			try {
				const session = await apiFetch<SessionResponse>("/api/auth/get-session");
				if (session.user) {
					setEmail(session.user.email);
					setUser({
						name: session.user.name ?? session.user.email.split("@")[0] ?? "User",
						tier: "PRO",
						buildsUsed: 0,
						buildsLimit: 50,
					});
				}
			} catch {
				// Not signed in — keep user null (UI shows sign-in CTA)
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const handleSignOut = async () => {
		try {
			await apiFetch("/api/auth/sign-out", { method: "POST" });
			window.location.href = "/login";
		} catch (err) {
			console.error("sign-out failed", err);
		}
	};

	return (
		<PageShell user={user ?? undefined}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / You</div>
				<h1 className="font-serif text-3xl font-normal text-zinc-300">Your Account</h1>
			</div>

			<div className="mx-auto w-full max-w-2xl px-8 py-8">
				{loading ? (
					<div className="text-sm text-white/50">Loading…</div>
				) : !user ? (
					<div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center">
						<UserIcon className="mx-auto mb-4 h-10 w-10 text-white/30" />
						<h2 className="mb-2 font-serif text-xl text-zinc-300">Chưa đăng nhập</h2>
						<p className="mb-6 text-sm text-white/50">
							Login với Editor team email để truy cập dashboard + project workspace.
						</p>
						<Link
							href="/login"
							className="inline-block rounded-md bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90"
						>
							Sign in
						</Link>
					</div>
				) : (
					<div className="space-y-4">
						<div className="rounded-xl border border-white/10 bg-zinc-900 p-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-lg font-semibold text-white">
									{user.name[0]?.toUpperCase()}
								</div>
								<div>
									<div className="text-base font-medium text-white/87">{user.name}</div>
									<div className="text-sm text-white/50">{email}</div>
								</div>
								<div className="ml-auto rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
									{user.tier} tier
								</div>
							</div>
						</div>

						<div className="rounded-xl border border-white/10 bg-zinc-900 p-6">
							<h3 className="mb-3 flex items-center gap-2 font-serif text-base text-zinc-300">
								<CreditCard className="h-4 w-4" />
								Usage tháng này
							</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-white/50">Quick Create builds</span>
									<span className="text-white/87">
										{user.buildsUsed}/{user.buildsLimit === -1 ? "∞" : user.buildsLimit}
									</span>
								</div>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
									<div
										className="h-full bg-[#3B82F6]"
										style={{
											width: `${
												user.buildsLimit > 0
													? Math.min(100, (user.buildsUsed / user.buildsLimit) * 100)
													: 0
											}%`,
										}}
									/>
								</div>
							</div>
						</div>

						<div className="rounded-xl border border-white/10 bg-zinc-900 p-6">
							<h3 className="mb-3 flex items-center gap-2 font-serif text-base text-zinc-300">
								<Settings className="h-4 w-4" />
								Settings
							</h3>
							<p className="mb-4 text-sm text-white/50">
								Avatar / password / sessions ship Phase 2. Hôm nay chỉ có sign-out.
							</p>
							<button
								onClick={handleSignOut}
								className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
							>
								<LogOut className="h-4 w-4" />
								Sign out
							</button>
						</div>
					</div>
				)}
			</div>
		</PageShell>
	);
}
