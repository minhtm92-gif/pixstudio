/**
 * Sign-up page — better-auth email/password registration.
 *
 * Phase 0-3 internal access list — anh approves email allowlist manually.
 * No email verification required Phase 0 (D22).
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/auth/client";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const res = await signUp.email({ email, password, name });
			if (res.error) {
				setError(res.error.message ?? "Đăng ký thất bại — email có thể đã tồn tại");
				return;
			}
			router.push("/");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Đăng ký thất bại");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-black p-6">
			<div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl">
				<Link href="/" className="mb-6 flex items-center gap-2.5">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3DA8F5] via-[#3B82F6] to-[#1E40AF] font-serif text-base font-semibold text-white">
						P
					</div>
					<span className="font-serif text-lg text-zinc-300">PixStudio</span>
				</Link>
				<h1 className="mb-1 font-serif text-2xl font-normal text-zinc-300">Đăng ký</h1>
				<p className="mb-6 text-sm text-white/50">
					Internal alpha — chỉ Editor team + đối tác duyệt trước.
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-xs font-medium text-white/70">Tên hiển thị</label>
						<input
							type="text"
							required
							maxLength={80}
							autoComplete="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Nguyen Van A"
							className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white/87 placeholder-white/30 focus:border-[#3B82F6] focus:outline-none"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs font-medium text-white/70">Email</label>
						<input
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@pixelxlab.com"
							className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white/87 placeholder-white/30 focus:border-[#3B82F6] focus:outline-none"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs font-medium text-white/70">
							Password (≥ 8 ký tự)
						</label>
						<input
							type="password"
							required
							minLength={8}
							maxLength={128}
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white/87 placeholder-white/30 focus:border-[#3B82F6] focus:outline-none"
						/>
					</div>
					{error && (
						<div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
							{error}
						</div>
					)}
					<button
						type="submit"
						disabled={submitting}
						className="w-full rounded-md bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
					>
						{submitting ? "Đang đăng ký..." : "Đăng ký"}
					</button>
				</form>

				<div className="mt-6 text-center text-xs text-white/50">
					Đã có account?{" "}
					<Link href="/login" className="text-[#60A5FA] hover:underline">
						Đăng nhập
					</Link>
				</div>
			</div>
		</div>
	);
}
