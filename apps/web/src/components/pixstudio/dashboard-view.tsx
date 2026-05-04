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

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Sparkles, ChevronRight, Image as ImageIcon, Music, Layout, User as UserIcon, Lightbulb, Video, Info, FileText, X, Loader2 } from "lucide-react";
import { Sidebar } from "./sidebar";
import { apiFetch, type PixStudioUser } from "@/lib/api-client";

type Mode = "pro" | "quick";
type QuickPath = "ideaA" | "videoB";
type Section = "models" | "projects" | "trends" | "workflows" | "explore";

const VIDEO_URL_PATTERN =
	/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?|youtu\.be\/|tiktok\.com\/|instagram\.com\/(?:reel|p)\/|vimeo\.com\/)/i;

interface WorkspaceRow {
	id: string;
	name: string;
}

interface SessionResponse {
	id: string;
	pathBJobId?: string | null;
	pathBVideoUrl?: string | null;
}

interface HeroAttachment {
	id: string;
	name: string;
	type: "image" | "pdf" | "audio";
	r2Key: string;
	publicUrl: string | null;
	sizeBytes: number;
}

const ATTACHMENT_ACCEPT_MIME =
	"image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav,audio/mp4";

const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

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
	const [quickPath, setQuickPath] = useState<QuickPath>("ideaA");
	const [section, setSection] = useState<Section>("models");
	const [prompt, setPrompt] = useState("");
	const [videoUrl, setVideoUrl] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [pathBInfo, setPathBInfo] = useState<string | null>(null);
	const [pathBError, setPathBError] = useState<string | null>(null);
	// QC-4 (SCOPE §4.2): Hero "+ button" — attach reference materials.
	// Phase 2 mandate: image (Gemini vision describe) + PDF (text extract).
	// Audio: Phase 3 Max tier (voice clone). Video: route via Path B toggle, NOT here.
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [attachments, setAttachments] = useState<HeroAttachment[]>([]);
	const [attachmentBusy, setAttachmentBusy] = useState(false);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);

	// Path B (SCOPE §13 D37): manual MP4 upload alternative to URL paste.
	// Per scope "drag-drop MP4 hoặc URL YouTube/TikTok/Reel" — both must work.
	const pathBFileInputRef = useRef<HTMLInputElement | null>(null);
	const [pathBFile, setPathBFile] = useState<{
		name: string;
		r2Key: string;
		sizeBytes: number;
	} | null>(null);
	const [pathBFileBusy, setPathBFileBusy] = useState(false);
	const [pathBFileDragging, setPathBFileDragging] = useState(false);

	const urlValid = VIDEO_URL_PATTERN.test(videoUrl.trim());

	const handleAttachClick = () => fileInputRef.current?.click();

	const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// Reset so the same file can be picked again after remove.
		if (e.target.value) e.target.value = "";
		if (!file) return;
		setAttachmentError(null);
		if (file.size > ATTACHMENT_MAX_BYTES) {
			setAttachmentError(`File quá lớn (max 20MB) — file của anh ${(file.size / 1024 / 1024).toFixed(1)}MB`);
			return;
		}
		const kind: HeroAttachment["type"] = file.type.startsWith("image/")
			? "image"
			: file.type === "application/pdf"
				? "pdf"
				: file.type.startsWith("audio/")
					? "audio"
					: (() => {
							setAttachmentError("Chỉ hỗ trợ image (JPG/PNG/WebP), PDF, hoặc audio (MP3/WAV)");
							return "image" as const;
						})();
		if (attachmentError) return;
		setAttachmentBusy(true);
		try {
			const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
			const firstWs = ws.items[0];
			if (!firstWs) {
				router.push(`/login?next=${encodeURIComponent("/")}`);
				return;
			}
			const presign = await apiFetch<{
				presignedUrl: string;
				r2Key: string;
				publicUrl: string | null;
			}>(`/api/quick-create/hero-attachments/presign`, {
				method: "POST",
				body: JSON.stringify({
					workspaceId: firstWs.id,
					filename: file.name,
					mimeType: file.type,
					sizeBytes: file.size,
					kind,
				}),
			});
			const putRes = await fetch(presign.presignedUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});
			if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}`);
			setAttachments((prev) => [
				...prev,
				{
					id: presign.r2Key,
					name: file.name,
					type: kind,
					r2Key: presign.r2Key,
					publicUrl: presign.publicUrl,
					sizeBytes: file.size,
				},
			]);
		} catch (err) {
			setAttachmentError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setAttachmentBusy(false);
		}
	};

	const removeAttachment = (id: string) =>
		setAttachments((prev) => prev.filter((a) => a.id !== id));

	const PATH_B_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
	const PATH_B_ACCEPT_MIME = "video/mp4,video/quicktime,video/x-matroska,video/webm";

	const handlePathBFile = async (file: File) => {
		setPathBError(null);
		setPathBInfo(null);
		if (!file.type.startsWith("video/")) {
			setPathBError("Chỉ hỗ trợ video (MP4, MOV, MKV, WebM)");
			return;
		}
		if (file.size > PATH_B_MAX_BYTES) {
			setPathBError(`Video quá lớn (max 500MB) — file của anh ${(file.size / 1024 / 1024).toFixed(1)}MB`);
			return;
		}
		setPathBFileBusy(true);
		try {
			const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
			const firstWs = ws.items[0];
			if (!firstWs) {
				router.push(`/login?next=${encodeURIComponent("/")}`);
				return;
			}
			const presign = await apiFetch<{ presignedUrl: string; r2Key: string }>(
				`/api/path-b/source-uploads/presign`,
				{
					method: "POST",
					body: JSON.stringify({
						workspaceId: firstWs.id,
						filename: file.name,
						mimeType: file.type,
						sizeBytes: file.size,
					}),
				},
			);
			const putRes = await fetch(presign.presignedUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});
			if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}`);
			setPathBFile({
				name: file.name,
				r2Key: presign.r2Key,
				sizeBytes: file.size,
			});
			// Clear URL field — file takes priority.
			setVideoUrl("");
		} catch (err) {
			setPathBError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setPathBFileBusy(false);
		}
	};

	const handlePathBFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (e.target.value) e.target.value = "";
		if (file) void handlePathBFile(file);
	};

	const handlePathBDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setPathBFileDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) void handlePathBFile(file);
	};

	const removePathBFile = () => {
		setPathBFile(null);
		setPathBError(null);
	};

	const handleSubmit = async () => {
		setPathBError(null);
		setPathBInfo(null);

		if (mode === "pro") {
			if (!prompt.trim()) return;
			router.push(`/projects?prompt=${encodeURIComponent(prompt)}`);
			return;
		}

		// mode === "quick"
		if (quickPath === "ideaA") {
			if (!prompt.trim()) return;
			const params = new URLSearchParams({ prompt });
			if (attachments.length > 0) {
				params.set("attachments", attachments.map((a) => a.r2Key).join(","));
			}
			router.push(`/quick-create/workflows?${params.toString()}`);
			return;
		}

		// Path B — paste video URL OR uploaded file → POST session + show status
		const hasFile = pathBFile !== null;
		const hasUrl = urlValid;
		if (!hasFile && !hasUrl) {
			setPathBError(
				"Cần một trong hai: paste URL (YouTube/TikTok/Reel/Vimeo) HOẶC upload file MP4",
			);
			return;
		}
		setSubmitting(true);
		try {
			const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
			const firstWs = ws.items[0];
			if (!firstWs) {
				router.push(`/login?next=${encodeURIComponent("/")}`);
				return;
			}
			const session = await apiFetch<SessionResponse>("/api/quick-create/sessions", {
				method: "POST",
				body: JSON.stringify({
					workspaceId: firstWs.id,
					mode: "pathB",
					prompt: "",
					...(hasFile
						? { pathBSourceR2Key: pathBFile.r2Key }
						: { pathBVideoUrl: videoUrl.trim() }),
				}),
			});
			if (session.pathBJobId) {
				router.push(`/path-b/${session.pathBJobId}`);
				return;
			}
			setPathBInfo(
				`✓ Em đã save link cho anh (session ${session.id.slice(0, 8)}). Pipeline pending — anh check trong admin queue.`,
			);
			setVideoUrl("");
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Network error";
			if (msg.includes("401") || msg.includes("Unauthorized")) {
				router.push(`/login?next=${encodeURIComponent("/")}`);
				return;
			}
			setPathBError(msg);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />

			<main className="flex flex-1 flex-col overflow-x-hidden">
				{/* Top bar */}
				<div className="flex items-center justify-end gap-3 px-7 py-3.5">
					{user?.tier !== "MAX" && (
						<button
							type="button"
							onClick={() => router.push("/account")}
							className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white/87 hover:bg-zinc-700"
						>
							{user?.tier === "PRO" ? "⚡ Upgrade to MAX" : "⚡ Tăng tier"}
						</button>
					)}
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

					{/* Quick Create sub-toggle: Path A (idea) vs Path B (video reference) */}
					{mode === "quick" && (
						<div className="mb-3 flex justify-center">
							<div className="inline-flex gap-1 rounded-full border border-white/10 bg-zinc-900/40 p-1">
								<button
									type="button"
									onClick={() => {
										setQuickPath("ideaA");
										setPathBError(null);
										setPathBInfo(null);
									}}
									className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
										quickPath === "ideaA"
											? "bg-zinc-800 text-white"
											: "text-white/50 hover:text-white"
									}`}
								>
									<Lightbulb className="h-3 w-3" />
									Từ ý tưởng
								</button>
								<button
									type="button"
									onClick={() => {
										setQuickPath("videoB");
										setPathBError(null);
										setPathBInfo(null);
									}}
									className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
										quickPath === "videoB"
											? "bg-zinc-800 text-white"
											: "text-white/50 hover:text-white"
									}`}
								>
									<Video className="h-3 w-3" />
									Từ video tham khảo
								</button>
							</div>
						</div>
					)}

					{/* Hero input — textarea (Path A or Pro) OR URL input (Path B) */}
					{!(mode === "quick" && quickPath === "videoB") ? (
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
							{/* Attachment chips */}
							{attachments.length > 0 && (
								<div className="absolute bottom-14 left-3 right-3 flex flex-wrap gap-1.5">
									{attachments.map((a) => (
										<span
											key={a.id}
											className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-800 px-2 py-0.5 text-xs text-white/70"
										>
											{a.type === "image" ? (
												<ImageIcon className="h-3 w-3 text-blue-400" />
											) : a.type === "pdf" ? (
												<FileText className="h-3 w-3 text-orange-400" />
											) : (
												<Music className="h-3 w-3 text-purple-400" />
											)}
											<span className="max-w-[140px] truncate">{a.name}</span>
											<button
												type="button"
												onClick={() => removeAttachment(a.id)}
												className="ml-0.5 text-white/50 hover:text-white"
												title="Remove"
											>
												<X className="h-3 w-3" />
											</button>
										</span>
									))}
								</div>
							)}
							<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
								<button
									type="button"
									onClick={handleAttachClick}
									disabled={attachmentBusy}
									className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-50"
									title="Đính kèm ảnh sản phẩm / PDF brief / audio sample (max 20MB)"
								>
									{attachmentBusy ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Plus className="h-4 w-4" />
									)}
								</button>
								<input
									ref={fileInputRef}
									type="file"
									accept={ATTACHMENT_ACCEPT_MIME}
									onChange={(e) => void handleFilePicked(e)}
									className="hidden"
								/>
								<button
									type="button"
									onClick={() => void handleSubmit()}
									disabled={!prompt.trim() || submitting}
									className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
									title="Gửi"
								>
									<Send className="h-4 w-4" />
								</button>
							</div>
							{attachmentError && (
								<p className="mt-2 text-xs text-orange-400">⚠ {attachmentError}</p>
							)}
						</div>
					) : (
						<div
							className={`mb-5 space-y-3 rounded-xl border-2 border-dashed bg-zinc-900/40 p-6 transition-colors ${
								pathBFileDragging
									? "border-[#3B82F6] bg-[#3B82F6]/10"
									: "border-white/10"
							}`}
							onDragOver={(e) => {
								e.preventDefault();
								if (!pathBFileBusy) setPathBFileDragging(true);
							}}
							onDragLeave={(e) => {
								e.preventDefault();
								setPathBFileDragging(false);
							}}
							onDrop={handlePathBDrop}
						>
							<div className="flex items-center gap-3 text-white/60">
								<Video className="h-5 w-5 shrink-0" />
								<div>
									<div className="text-sm font-medium text-white/87">
										Video tham khảo — paste URL HOẶC upload file
									</div>
									<div className="text-[11px] text-white/50">
										YouTube · TikTok · Instagram Reel · Vimeo HOẶC drag-drop / chọn MP4
										(max 500MB). Em phân tích cảnh + âm thanh + script + rebuild với
										assets của anh.
									</div>
								</div>
							</div>

							{/* Uploaded file chip */}
							{pathBFile && (
								<div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
									<Video className="h-4 w-4 text-green-400 shrink-0" />
									<div className="min-w-0 flex-1">
										<div className="truncate text-white/87">{pathBFile.name}</div>
										<div className="text-[10px] text-white/50">
											{(pathBFile.sizeBytes / 1024 / 1024).toFixed(1)}MB · uploaded ✓
										</div>
									</div>
									<button
										type="button"
										onClick={removePathBFile}
										disabled={submitting}
										className="text-white/50 hover:text-white"
										title="Remove"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							)}

							{/* URL input + file picker + submit */}
							{!pathBFile && (
								<>
									<div className="flex gap-2">
										<input
											type="url"
											value={videoUrl}
											onChange={(e) => setVideoUrl(e.target.value)}
											placeholder="https://www.youtube.com/watch?v=..."
											disabled={submitting || pathBFileBusy}
											className="flex-1 rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87 placeholder-white/30 focus:border-[#3B82F6] focus:outline-none disabled:opacity-50"
										/>
										<button
											type="button"
											onClick={() => pathBFileInputRef.current?.click()}
											disabled={pathBFileBusy || submitting}
											className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white/87 hover:bg-zinc-700 disabled:opacity-50"
											title="Upload MP4 từ máy (drag-drop into khung này cũng work)"
										>
											{pathBFileBusy ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<Plus className="h-3.5 w-3.5" />
											)}
											{pathBFileBusy ? "Uploading..." : "Upload file"}
										</button>
										<input
											ref={pathBFileInputRef}
											type="file"
											accept={PATH_B_ACCEPT_MIME}
											onChange={handlePathBFilePicked}
											className="hidden"
										/>
									</div>
									{videoUrl.trim().length > 0 && !urlValid && (
										<div className="text-[11px] text-orange-400">
											URL phải bắt đầu bằng youtube.com / youtu.be / tiktok.com /
											instagram.com/reel / vimeo.com
										</div>
									)}
								</>
							)}

							{/* Phân tích button — visible when URL OR file ready */}
							{(pathBFile || urlValid) && (
								<button
									type="button"
									onClick={() => void handleSubmit()}
									disabled={submitting}
									className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
								>
									{submitting ? "Đang xử lý..." : "Phân tích →"}
								</button>
							)}

							<div className="text-[11px] text-white/40">
								Cost ~$0.07-0.10/phút · Quota: Standard 5min · Pro 30min · Max 120min
							</div>
							{pathBError && (
								<div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
									<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
									<span>{pathBError}</span>
								</div>
							)}
							{pathBInfo && (
								<div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
									<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
									<span>{pathBInfo}</span>
								</div>
							)}
						</div>
					)}

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
