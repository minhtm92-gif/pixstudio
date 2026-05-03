/**
 * Path B reverse engineer status page (Sprint 28).
 *
 * After Home Path B submit creates ReverseEngineerJob, redirect users here
 * to track extraction progress. Polls /api/path-b/jobs/:id every 3s.
 *
 * On COMPLETED → POST handoff → redirect Quick Create editor (3-tab View 6)
 * On FAILED → show error + retry button
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Video, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import { apiFetch, type PixStudioUser } from "@/lib/api-client";

type JobStatus =
	| "PENDING"
	| "DOWNLOADING"
	| "EXTRACTING_AUDIO"
	| "DETECTING_SCENES"
	| "SEPARATING_STEMS"
	| "TRANSCRIBING"
	| "IDENTIFYING_MUSIC"
	| "ANALYZING_VISUAL"
	| "BUILDING_STATE"
	| "COMPLETED"
	| "FAILED"
	| "CANCELLED";

interface JobRow {
	id: string;
	sessionId: string;
	status: JobStatus;
	progress: number;
	sourceUrl: string | null;
	errorMessage: string | null;
	totalCostUsd: number;
	createdAt: string;
	completedAt: string | null;
}

const STUB_USER: PixStudioUser = {
	name: "Demo",
	tier: "PRO",
	buildsUsed: 0,
	buildsLimit: 50,
};

const STATUS_LABELS: Record<JobStatus, string> = {
	PENDING: "Đang chờ xử lý...",
	DOWNLOADING: "Đang tải video tham khảo (yt-dlp)",
	EXTRACTING_AUDIO: "Đang tách audio (FFmpeg)",
	DETECTING_SCENES: "Đang phát hiện phân cảnh (FFmpeg)",
	SEPARATING_STEMS: "Đang tách stem nhạc (Demucs)",
	TRANSCRIBING: "Đang transcribe lời thoại (ElevenLabs Scribe)",
	IDENTIFYING_MUSIC: "Đang nhận diện nhạc nền (Chromaprint)",
	ANALYZING_VISUAL: "Đang phân tích hình ảnh (Gemini 2.5 Pro)",
	BUILDING_STATE: "Đang build editor state",
	COMPLETED: "Hoàn thành ✓",
	FAILED: "Pipeline thất bại",
	CANCELLED: "Đã hủy",
};

export default function PathBJobStatusPage() {
	const params = useParams();
	const router = useRouter();
	const jobId = params.jobId as string;

	const [job, setJob] = useState<JobRow | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [handoffing, setHandoffing] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const poll = async () => {
			try {
				const data = await apiFetch<JobRow>(`/api/path-b/jobs/${jobId}`);
				if (cancelled) return;
				setJob(data);
				setError(null);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to fetch job");
			}
		};
		void poll();
		const interval = setInterval(() => void poll(), 3000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [jobId]);

	useEffect(() => {
		if (job?.status === "COMPLETED" && !handoffing) {
			void handoff();
		}
	}, [job?.status]);

	const handoff = async () => {
		if (!job) return;
		setHandoffing(true);
		try {
			const res = await apiFetch<{ projectId: string; editorUrl: string }>(
				`/api/path-b/jobs/${jobId}/handoff`,
				{ method: "POST" },
			);
			router.push(res.editorUrl);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Handoff failed");
			setHandoffing(false);
		}
	};

	const isPipeline =
		job?.status &&
		!["PENDING", "COMPLETED", "FAILED", "CANCELLED"].includes(job.status);
	const isError = job?.status === "FAILED" || job?.status === "CANCELLED";
	const isDone = job?.status === "COMPLETED";

	return (
		<PageShell user={STUB_USER}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Path B / Status</div>
				<h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-normal text-zinc-300">
					<Video className="h-7 w-7 text-[#60A5FA]" />
					Path B Reverse Engineer
				</h1>
				{job?.sourceUrl && (
					<p className="mt-1.5 text-sm text-white/50">
						Source: <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-white/87">{job.sourceUrl}</code>
					</p>
				)}
			</div>

			<div className="mx-auto w-full max-w-2xl px-8 py-8">
				{error && (
					<div className="mb-4 flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-300">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{!job && !error && (
					<div className="text-sm text-white/50">Loading job…</div>
				)}

				{job && (
					<div className="rounded-xl border border-white/10 bg-zinc-900 p-6">
						<div className="mb-4 flex items-center gap-3">
							{isDone ? (
								<CheckCircle2 className="h-6 w-6 text-green-400" />
							) : isError ? (
								<AlertCircle className="h-6 w-6 text-red-400" />
							) : (
								<Loader2 className="h-6 w-6 animate-spin text-[#60A5FA]" />
							)}
							<div>
								<div className="text-base font-medium text-white/87">
									{STATUS_LABELS[job.status]}
								</div>
								<div className="text-xs text-white/50">Job {job.id.slice(0, 8)}</div>
							</div>
						</div>

						{/* Progress bar */}
						<div className="mb-3">
							<div className="mb-1 flex items-center justify-between text-xs text-white/50">
								<span>Progress</span>
								<span>{job.progress}%</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-zinc-800">
								<div
									className={`h-full transition-all ${
										isError ? "bg-red-500" : isDone ? "bg-green-500" : "bg-[#3B82F6]"
									}`}
									style={{ width: `${job.progress}%` }}
								/>
							</div>
						</div>

						{job.errorMessage && (
							<div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
								{job.errorMessage}
							</div>
						)}

						{job.totalCostUsd > 0 && (
							<div className="mt-3 text-xs text-white/40">
								Cost: ${Number(job.totalCostUsd).toFixed(4)} USD
							</div>
						)}

						{isDone && (
							<button
								type="button"
								onClick={() => void handoff()}
								disabled={handoffing}
								className="mt-4 flex items-center gap-2 rounded-md bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50"
							>
								{handoffing ? "Đang mở Quick Create Editor..." : "Mở Quick Create Editor"}
								<ArrowRight className="h-4 w-4" />
							</button>
						)}

						{isError && (
							<button
								type="button"
								onClick={() => router.push("/")}
								className="mt-4 rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
							>
								Quay lại Home
							</button>
						)}

						{isPipeline && (
							<p className="mt-4 text-xs text-white/40">
								Pipeline 6 stages, total ~2-5 phút cho 1-min reference video. Trang
								này tự refresh mỗi 3s.
							</p>
						)}
					</div>
				)}
			</div>
		</PageShell>
	);
}
