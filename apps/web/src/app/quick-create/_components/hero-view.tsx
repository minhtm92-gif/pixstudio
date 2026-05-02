"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Video, Lightbulb, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { quickCreateApi, ApiError } from "@/lib/quick-create-api";

const MAX_PROMPT_LENGTH = 25_000;

type Mode = "pathA" | "pathB";

interface HeroViewProps {
	/** Pass authenticated user's bearer token + workspace context */
	token?: string;
	defaultWorkspaceId?: string;
}

export function HeroView({ token, defaultWorkspaceId }: HeroViewProps = {}) {
	const router = useRouter();
	const [prompt, setPrompt] = useState("");
	const [mode, setMode] = useState<Mode>("pathA");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const charCount = prompt.length;
	const overLimit = charCount > MAX_PROMPT_LENGTH;
	const canSubmit = prompt.trim().length > 0 && !overLimit && !submitting;

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setSubmitting(true);
		setError(null);
		try {
			if (!token || !defaultWorkspaceId) {
				// No auth context — for unauthed visitors, send to login
				router.push(`/login?redirect=/quick-create&prompt=${encodeURIComponent(prompt)}`);
				return;
			}
			const session = await quickCreateApi.createSession(token, {
				workspaceId: defaultWorkspaceId,
				prompt,
				mode,
			});
			router.push(`/quick-create/workflows?sessionId=${session.id}`);
		} catch (err) {
			console.error("[quick-create] create session failed", err);
			if (err instanceof ApiError) {
				setError(err.message);
			} else {
				setError("Network error — vui lòng thử lại");
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-8">
			{/* Heading */}
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-4xl md:text-5xl tracking-tight">
					Quick Create
				</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground text-lg">
					Tạo video AI từ <strong>ý tưởng</strong> hoặc{" "}
					<strong>video tham khảo</strong> trong vài phút. Tune sẵn 8 workflow
					phù hợp creator Việt Nam.
				</p>
			</div>

			{/* Mode toggle */}
			<div className="flex justify-center">
				<div className="inline-flex rounded-lg border bg-muted/30 p-1">
					<button
						type="button"
						onClick={() => setMode("pathA")}
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
						onClick={() => setMode("pathB")}
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

			{/* Path A: Prompt input */}
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
						<span
							className={
								overLimit ? "text-destructive" : "text-muted-foreground"
							}
						>
							{charCount.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()}{" "}
							ký tự
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

			{/* Path B: Video reference input */}
			{mode === "pathB" && (
				<div className="space-y-3 rounded-lg border-2 border-dashed p-8 text-center">
					<Video className="mx-auto h-12 w-12 text-muted-foreground" />
					<div className="space-y-1">
						<p className="font-medium">Upload MP4 hoặc paste URL video</p>
						<p className="text-muted-foreground text-sm">
							YouTube, TikTok, Instagram Reel — em sẽ phân tích cảnh / âm thanh /
							script và rebuild video tương tự với assets của anh
						</p>
					</div>
					<input
						type="url"
						placeholder="https://www.tiktok.com/@user/video/..."
						className="mx-auto w-full max-w-xl rounded-md border bg-background px-3 py-2 text-sm"
						disabled={submitting}
					/>
					<p className="text-muted-foreground text-xs">
						Cost ~$0.07-0.10 / phút video reference. Quota: Standard 5min/mo · Pro
						30min · Max 120min.
					</p>
				</div>
			)}

			{/* Error banner */}
			{error && (
				<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
					<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{/* Submit CTA */}
			<div className="flex justify-center">
				<Button
					size="lg"
					onClick={handleSubmit}
					disabled={!canSubmit && mode === "pathA"}
					className="px-8"
				>
					<Sparkles className="mr-2 h-5 w-5" />
					{submitting ? "Đang tạo..." : "Tạo video"}
				</Button>
			</div>

			{/* Footer hints */}
			<p className="text-center text-muted-foreground text-xs">
				Quick Create v1.0 · Phase 1 Sprint 1 ·{" "}
				<a
					href="/quick-create/workflows"
					className="underline-offset-4 hover:text-foreground hover:underline"
				>
					8 workflows tune sẵn
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
