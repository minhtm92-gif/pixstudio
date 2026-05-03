/**
 * Final preview component — Quick Create View 7 (SCOPE §3.2).
 *
 * Layout:
 *   - Video player (preview MP4 from rendered build)
 *   - AI suggestion bubble (1-2 hint per generation)
 *   - Chat command edit (natural-language refine)
 *   - Action buttons: Edit (→ Editor 3-tab), Download MP4, Generate variant
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Sparkles,
	Download,
	Edit3,
	RefreshCw,
	Loader2,
	AlertCircle,
	Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

interface FinalPreviewProps {
	workflowId: string;
	sessionId: string;
}

interface SessionRow {
	id: string;
	workflowId: string | null;
	prompt: string;
	outlineJson: {
		title?: string;
		previewVideoUrl?: string;
		previewVideoR2Key?: string;
		editorState?: Record<string, unknown>;
	} | null;
	buildJobId: string | null;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
}

export function FinalPreview({ workflowId, sessionId }: FinalPreviewProps) {
	const router = useRouter();
	const [session, setSession] = useState<SessionRow | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState("");
	const [chatBusy, setChatBusy] = useState(false);
	const [regenBusy, setRegenBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<SessionRow>(
					`/api/quick-create/sessions/${sessionId}`,
				);
				if (cancelled) return;
				setSession(res);
				const title = res.outlineJson?.title ?? "your video";
				setChatMessages([
					{
						id: "ai-welcome",
						role: "assistant",
						text: `✓ Done! Em đã render xong "${title}". Anh thử mở rộng câu chuyện hoặc đổi pacing không? Em có thể edit trực tiếp từ chat.`,
					},
				]);
			} catch (err) {
				if (!cancelled)
					setError(err instanceof Error ? err.message : "Failed to load session");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	const handleChatSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const text = chatInput.trim();
		if (!text || chatBusy) return;
		setChatBusy(true);
		const userMsg: ChatMessage = {
			id: `u-${Date.now()}`,
			role: "user",
			text,
		};
		setChatMessages((m) => [...m, userMsg]);
		setChatInput("");
		try {
			const reply = await apiFetch<{ reply: string }>(
				`/api/agent/chat`,
				{
					method: "POST",
					body: JSON.stringify({
						projectId: sessionId,
						message: text,
						context: { surface: "quick-create-final" },
					}),
				},
			);
			setChatMessages((m) => [
				...m,
				{ id: `a-${Date.now()}`, role: "assistant", text: reply.reply },
			]);
		} catch (err) {
			setChatMessages((m) => [
				...m,
				{
					id: `e-${Date.now()}`,
					role: "assistant",
					text:
						"❌ Em đang offline với agent chat. Anh dùng nút Edit chuyển qua Editor để chỉnh thủ công nhé.",
				},
			]);
			void err;
		} finally {
			setChatBusy(false);
		}
	};

	const handleRegen = async () => {
		setRegenBusy(true);
		try {
			await apiFetch(`/api/quick-create/sessions/${sessionId}/build`, {
				method: "POST",
			});
			router.push(
				`/quick-create/workflows/${workflowId}/build?sessionId=${sessionId}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Regen failed");
			setRegenBusy(false);
		}
	};

	const previewUrl = session?.outlineJson?.previewVideoUrl ?? null;
	const title = session?.outlineJson?.title ?? "Untitled video";

	if (loading) {
		return (
			<div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
				<Loader2 className="h-8 w-8 animate-spin" />
				<p>Loading preview…</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center gap-3 py-20 text-destructive">
				<AlertCircle className="h-8 w-8" />
				<p className="text-sm">{error}</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
			{/* Left: video + actions */}
			<div className="space-y-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">{title}</h1>
					<p className="text-sm text-muted-foreground">
						View 7 · Final preview · Workflow {workflowId}
					</p>
				</div>

				{/* Video player */}
				<div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
					{previewUrl ? (
						<video
							src={previewUrl}
							controls
							className="h-full w-full"
							preload="metadata"
						/>
					) : (
						<div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
							<AlertCircle className="h-6 w-6" />
							<p className="text-sm">
								Preview MP4 not ready — Stage 5 RENDERING_PREVIEW chưa ship.
							</p>
							<p className="text-xs">
								Anh có thể bấm Edit để mở Editor view (scenes + script + music ready).
							</p>
						</div>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={() =>
							router.push(
								`/quick-create/workflows/${workflowId}/editor?sessionId=${sessionId}`,
							)
						}
						className="gap-2"
					>
						<Edit3 className="h-4 w-4" />
						Edit
					</Button>
					<Button
						variant="outline"
						disabled={!previewUrl}
						onClick={() => previewUrl && window.open(previewUrl, "_blank")}
						className="gap-2"
					>
						<Download className="h-4 w-4" />
						Download MP4
					</Button>
					<Button
						variant="outline"
						onClick={() => void handleRegen()}
						disabled={regenBusy}
						className="gap-2"
					>
						{regenBusy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						Generate variant
					</Button>
				</div>
			</div>

			{/* Right: AI chat command edit */}
			<aside className="flex flex-col rounded-lg border bg-card">
				<div className="border-b px-3 py-2 flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					<span className="text-sm font-semibold">AI suggestions</span>
				</div>
				<div className="flex-1 space-y-3 overflow-y-auto p-3 max-h-[60vh]">
					{chatMessages.map((msg) => (
						<div
							key={msg.id}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
									msg.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-muted"
								}`}
							>
								{msg.text}
							</div>
						</div>
					))}
					{chatBusy && (
						<div className="flex justify-start">
							<div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
								<Loader2 className="inline h-3.5 w-3.5 animate-spin" />
							</div>
						</div>
					)}
				</div>
				<form
					onSubmit={handleChatSubmit}
					className="border-t p-2 flex items-end gap-2"
				>
					<Textarea
						value={chatInput}
						onChange={(e) => setChatInput(e.target.value)}
						placeholder="Refine the video with chat command…"
						rows={2}
						className="resize-none text-sm"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								void handleChatSubmit(e as unknown as React.FormEvent);
							}
						}}
					/>
					<Button
						type="submit"
						size="icon"
						disabled={!chatInput.trim() || chatBusy}
						className="shrink-0"
					>
						<Send className="h-4 w-4" />
					</Button>
				</form>
			</aside>
		</div>
	);
}
