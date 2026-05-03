"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Video, Lightbulb, AlertCircle, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

const MAX_PROMPT_LENGTH = 25_000;

type Mode = "pathA" | "pathB";

interface WorkspaceRow {
	id: string;
	name: string;
}

interface SessionResponse {
	id: string;
	mode: "PATH_A" | "PATH_B";
	prompt: string;
	pathBVideoUrl?: string | null;
	pathBJobId?: string | null;
}

const VIDEO_URL_PATTERN =
	/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?|youtu\.be\/|tiktok\.com\/|instagram\.com\/(?:reel|p)\/|vimeo\.com\/)/i;

export function HeroView() {
	const router = useRouter();
	const [prompt, setPrompt] = useState("");
	const [videoUrl, setVideoUrl] = useState("");
	const [mode, setMode] = useState<Mode>("pathA");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);
	const [authLoading, setAuthLoading] = useState(true);

	// Bootstrap: fetch user's first workspace via cookie session.
	useEffect(() => {
		const bootstrap = async () => {
			try {
				const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
				const first = ws.items[0];
				if (first) {
					setWorkspaceId(first.id);
				} else {
					// Signed in but no workspace — auto-create personal one.
					try {
						const created = await apiFetch<WorkspaceRow>("/api/workspaces", {
							method: "POST",
							body: JSON.stringify({ name: "Personal", billingTier: "PRO" }),
						});
						setWorkspaceId(created.id);
					} catch (createErr) {
						console.error("[quick-create] workspace create failed", createErr);
					}
				}
			} catch (err) {
				// 401 = not signed in. Other errors logged for debugging.
				const msg = err instanceof Error ? err.message : String(err);
				if (!msg.includes("401") && !msg.includes("Unauthorized")) {
					console.error("[quick-create] workspace fetch failed", err);
				}
			} finally {
				setAuthLoading(false);
			}
		};
		void bootstrap();
	}, []);

	const charCount = prompt.length;
	const overLimit = charCount > MAX_PROMPT_LENGTH;
	const urlValid = VIDEO_URL_PATTERN.test(videoUrl.trim());

	const canSubmit =
		!submitting &&
		(mode === "pathA"
			? prompt.trim().length > 0 && !overLimit
			: urlValid);

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setError(null);
		setInfo(null);

		// Not signed in — preserve mode + input via query string for resume after login.
		if (!workspaceId) {
			const next = encodeURIComponent(
				`/quick-create?mode=${mode}&${mode === "pathA" ? "prompt" : "url"}=${encodeURIComponent(
					mode === "pathA" ? prompt : videoUrl,
				)}`,
			);
			router.push(`/login?next=${next}`);
			return;
		}

		setSubmitting(true);
		try {
			const session = await apiFetch<SessionResponse>(
				"/api/quick-create/sessions",
				{
					method: "POST",
					body: JSON.stringify({
						workspaceId,
						mode,
						prompt: mode === "pathA" ? prompt : "",
						pathBVideoUrl: mode === "pathB" ? videoUrl.trim() : undefined,
					}),
				},
			);

			if (mode === "pathA") {
				router.push(`/quick-create/workflows?sessionId=${session.id}`);
			} else {
				// Path B reverse engineer pipeline (GPU + FFmpeg + Whisper + Gemini visual)
				// is Sprint 10 work. Backend created session + job row; show clear status.
				setInfo(
					`✓ Em đã save link cho anh (session ${session.id.slice(0, 8)}). ` +
						`Path B reverse engineer pipeline đang được build (Sprint 10 — cần spawn GPU droplet ` +
						`+ chạy FFmpeg/Whisper/Gemini visual analysis ~2-5 phút/video). ` +
						`Anh sẽ nhận notification khi pipeline ready để run extraction.`,
				);
			}
		} catch (err) {
			console.error("[quick-create] submit failed", err);
			const msg = err instanceof Error ? err.message : "Network error";
			setError(msg);
		} finally {
			setSubmitting(false);
		}
	};

	// Resume after login: read query string + auto-fill state.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const m = params.get("mode") as Mode | null;
		if (m === "pathA" || m === "pathB") setMode(m);
		const p = params.get("prompt");
		if (p) setPrompt(p);
		const u = params.get("url");
		if (u) setVideoUrl(u);
	}, []);

	return (
		<div className="space-y-8">
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-4xl md:text-5xl tracking-tight">Quick Create</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground text-lg">
					Tạo video AI từ <strong>ý tưởng</strong> hoặc{" "}
					<strong>video tham khảo</strong> trong vài phút. Tune sẵn 9 workflow
					phù hợp creator Việt Nam.
				</p>
			</div>

			<div className="flex justify-center">
				<div className="inline-flex rounded-lg border bg-muted/30 p-1">
					<button
						type="button"
						onClick={() => {
							setMode("pathA");
							setError(null);
							setInfo(null);
						}}
						className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors ${
							mode === "pathA"
								? "bg-background text-foreground shadow"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Lightbulb className="h-4 w-4" />
						Tạo từ ý tưởng
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("pathB");
							setError(null);
							setInfo(null);
						}}
						className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors ${
							mode === "pathB"
								? "bg-background text-foreground shadow"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Video className="h-4 w-4" />
						Từ video tham khảo
					</button>
				</div>
			</div>

			{mode === "pathA" && (
				<div className="space-y-3">
					<Textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Cho em một chủ đề, ngôn ngữ và mô tả chi tiết. Ví dụ: 'Quảng cáo serum chống nắng SPF 50+ cho da dầu mụn — target nữ 18-30, hook 3s đầu tập trung benefit, ending CTA mua ngay link bio.'"
						className="min-h-[180px] resize-y text-base"
						disabled={submitting}
					/>
					<div className="flex items-center justify-between text-sm">
						<span className={overLimit ? "text-destructive" : "text-muted-foreground"}>
							{charCount.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()} ký tự
						</span>
						<Link
							href="/quick-create/workflows"
							className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
						>
							Browse workflows →
						</Link>
					</div>
				</div>
			)}

			{mode === "pathB" && (
				<div className="space-y-3 rounded-lg border-2 border-dashed p-8 text-center">
					<Video className="mx-auto h-12 w-12 text-muted-foreground" />
					<div className="space-y-1">
						<p className="font-medium">Paste URL video tham khảo</p>
						<p className="text-muted-foreground text-sm">
							YouTube, TikTok, Instagram Reel, Vimeo — em phân tích cảnh / âm thanh
							/ script và rebuild video tương tự với assets của anh.
						</p>
					</div>
					<input
						type="url"
						value={videoUrl}
						onChange={(e) => setVideoUrl(e.target.value)}
						placeholder="https://www.youtube.com/watch?v=..."
						className="mx-auto w-full max-w-xl rounded-md border bg-background px-3 py-2 text-sm"
						disabled={submitting}
					/>
					{videoUrl.trim().length > 0 && !urlValid && (
						<p className="text-xs text-orange-500">
							URL phải bắt đầu bằng youtube.com / youtu.be / tiktok.com / instagram.com/reel /
							vimeo.com
						</p>
					)}
					<p className="text-muted-foreground text-xs">
						Cost ~$0.07-0.10 / phút video reference. Quota: Standard 5min/mo · Pro
						30min · Max 120min.
					</p>
				</div>
			)}

			{error && (
				<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
					<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{info && (
				<div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-blue-300 text-sm">
					<Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
					<span>{info}</span>
				</div>
			)}

			<div className="flex justify-center">
				<Button
					type="button"
					size="lg"
					onClick={handleSubmit}
					disabled={!canSubmit || authLoading}
					className="px-8"
				>
					<Sparkles className="mr-2 h-5 w-5" />
					{authLoading
						? "Đang load..."
						: submitting
							? "Đang xử lý..."
							: !workspaceId
								? "Đăng nhập để tạo"
								: mode === "pathA"
									? "Tạo video"
									: "Phân tích video"}
				</Button>
			</div>

			<p className="text-center text-muted-foreground text-xs">
				Quick Create v1.0 ·{" "}
				<a
					href="/quick-create/workflows"
					className="underline-offset-4 hover:text-foreground hover:underline"
				>
					9 workflows tune sẵn
				</a>{" "}
				·{" "}
				<a
					href="/help/quick-create"
					className="underline-offset-4 hover:text-foreground hover:underline"
				>
					Hướng dẫn
				</a>
			</p>
		</div>
	);
}
