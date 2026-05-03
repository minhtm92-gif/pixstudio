"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Languages, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

interface OutlineReviewProps {
	workflowId: string;
	sessionId: string;
}

interface Scene {
	id: string;
	order: number;
	script: string;
	mediaQuery: string;
	durationSec: number;
}

interface Outline {
	title: string;
	scenes: Scene[];
	suggestedChips: {
		audiences: string[];
		lookFeel: string[];
		platform: string;
	};
}

const AUDIENCES_OPTIONS = [
	{ id: "senior-50plus-vn", labelVi: "Senior 50+ VN", labelEn: "Senior 50+ VN" },
	{ id: "genz-tiktok", labelVi: "Gen Z TikTok", labelEn: "Gen Z TikTok" },
	{ id: "young-parents", labelVi: "Phụ huynh trẻ", labelEn: "Young parents" },
	{ id: "office-worker", labelVi: "Dân văn phòng 25-40", labelEn: "Office worker 25-40" },
	{ id: "ecom-seller", labelVi: "Người bán hàng eCom", labelEn: "eCom seller" },
];

const LOOK_FEEL_OPTIONS = [
	{ id: "cinematic", labelVi: "Cinematic", labelEn: "Cinematic" },
	{ id: "vlog", labelVi: "Vlog daily", labelEn: "Vlog daily" },
	{ id: "ad-style", labelVi: "Ads thương mại", labelEn: "Commercial Ad" },
	{ id: "documentary", labelVi: "Documentary", labelEn: "Documentary" },
	{ id: "kawaii", labelVi: "Kawaii pastel", labelEn: "Kawaii pastel" },
];

const PLATFORM_OPTIONS = [
	{ id: "tiktok", labelVi: "TikTok", labelEn: "TikTok", ratio: "9:16" },
	{ id: "youtube-shorts", labelVi: "YouTube Shorts", labelEn: "YouTube Shorts", ratio: "9:16" },
	{ id: "ig-reels", labelVi: "Instagram Reels", labelEn: "Instagram Reels", ratio: "9:16" },
	{ id: "fb-reels", labelVi: "Facebook Reels", labelEn: "Facebook Reels", ratio: "9:16" },
	{ id: "youtube-long", labelVi: "YouTube long", labelEn: "YouTube long-form", ratio: "16:9" },
];

export function OutlineReview({ workflowId, sessionId }: OutlineReviewProps) {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [outline, setOutline] = useState<Outline | null>(null);
	const [titleEdit, setTitleEdit] = useState("");
	const [audienceIds, setAudienceIds] = useState<Set<string>>(new Set());
	const [lookFeelIds, setLookFeelIds] = useState<Set<string>>(new Set());
	const [platformId, setPlatformId] = useState("tiktok");
	const [lang, setLang] = useState<"vi" | "en">("vi");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [costUsd, setCostUsd] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<{
					outline: Outline;
					meta?: { costUsd?: number; durationMs?: number; mock?: boolean };
				}>(`/api/quick-create/sessions/${sessionId}/outline?live=true&lang=${lang}`, {
					method: "POST",
				});
				if (cancelled) return;
				setOutline(res.outline);
				setTitleEdit(res.outline.title);
				setAudienceIds(new Set(res.outline.suggestedChips.audiences));
				setLookFeelIds(new Set(res.outline.suggestedChips.lookFeel));
				setPlatformId(res.outline.suggestedChips.platform);
				if (res.meta?.costUsd) setCostUsd(res.meta.costUsd);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to generate outline");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId]);

	const toggleSet = (set: Set<string>, id: string, max: number): Set<string> => {
		const next = new Set(set);
		if (next.has(id)) next.delete(id);
		else if (next.size < max) next.add(id);
		return next;
	};

	const handleBuild = async () => {
		setSubmitting(true);
		setError(null);
		try {
			// Persist chip selections + edited title to session before kicking build.
			await apiFetch(`/api/quick-create/sessions/${sessionId}/chips`, {
				method: "PATCH",
				body: JSON.stringify({
					audiences: [...audienceIds],
					lookFeel: [...lookFeelIds],
					platform: platformId,
				}),
			});
			await apiFetch(`/api/quick-create/sessions/${sessionId}/build`, {
				method: "POST",
			});
			router.push(
				`/quick-create/workflows/${workflowId}/build?sessionId=${sessionId}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start build");
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
				<Loader2 className="h-8 w-8 animate-spin" />
				<p>Đang tạo outline qua DO Inference... (~5-15s)</p>
			</div>
		);
	}

	if (error && !outline) {
		return (
			<div className="flex flex-col items-center gap-3 py-20 text-destructive">
				<AlertCircle className="h-8 w-8" />
				<p className="text-sm">{error}</p>
				<Button variant="outline" size="sm" onClick={() => router.back()}>
					Quay lại config
				</Button>
			</div>
		);
	}

	if (!outline) return null;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="space-y-1">
				<h1 className="font-bold text-3xl tracking-tight">Review outline</h1>
				<p className="text-muted-foreground">
					AI gen title + scene breakdown. Anh edit gì cần customize trước khi build.
				</p>
			</div>

			{/* Title editable */}
			<div className="space-y-2">
				<label htmlFor="title" className="font-medium text-sm">
					Title
				</label>
				<Input
					id="title"
					value={titleEdit}
					onChange={(e) => setTitleEdit(e.target.value)}
					className="text-lg"
					maxLength={200}
				/>
			</div>

			{/* Scene strip */}
			<div className="space-y-3">
				<h2 className="font-semibold text-lg">
					Scenes ({outline.scenes.length}) ·{" "}
					{outline.scenes.reduce((s, sc) => s + sc.durationSec, 0)}s total
				</h2>
				<div className="space-y-2">
					{outline.scenes.map((scene) => (
						<div
							key={scene.id}
							className="flex gap-3 rounded-lg border bg-card p-3"
						>
							<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-muted font-bold text-lg">
								{scene.order}
							</div>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="text-sm">{scene.script}</p>
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<span>📷 {scene.mediaQuery}</span>
									<span>·</span>
									<span>{scene.durationSec}s</span>
								</div>
							</div>
						</div>
					))}
				</div>
				<p className="text-muted-foreground text-xs">
					Sprint 2 next: edit scene script inline, regen affected scenes only
					(incremental TTS save quota).
				</p>
			</div>

			{/* Chip selectors */}
			<section className="space-y-6 rounded-lg border bg-card p-6">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-lg">Customize chips</h2>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setLang(lang === "vi" ? "en" : "vi")}
						className="gap-1"
					>
						<Languages className="h-4 w-4" />
						Dịch ({lang === "vi" ? "EN" : "VN"})
					</Button>
				</div>

				{/* Audience */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label className="font-medium text-sm">
							Audience (chọn 1-3) · {audienceIds.size}/3
						</label>
					</div>
					<div className="flex flex-wrap gap-2">
						{AUDIENCES_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setAudienceIds((s) => toggleSet(s, opt.id, 3))}
								className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
									audienceIds.has(opt.id)
										? "border-primary bg-primary text-primary-foreground"
										: "hover:bg-muted"
								}`}
							>
								{audienceIds.has(opt.id) && <Check className="-ml-0.5 mr-1 inline h-3 w-3" />}
								{lang === "vi" ? opt.labelVi : opt.labelEn}
							</button>
						))}
					</div>
				</div>

				{/* Look & Feel */}
				<div className="space-y-2">
					<label className="font-medium text-sm">
						Look & Feel (chọn 1-2) · {lookFeelIds.size}/2
					</label>
					<div className="flex flex-wrap gap-2">
						{LOOK_FEEL_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setLookFeelIds((s) => toggleSet(s, opt.id, 2))}
								className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
									lookFeelIds.has(opt.id)
										? "border-primary bg-primary text-primary-foreground"
										: "hover:bg-muted"
								}`}
							>
								{lookFeelIds.has(opt.id) && <Check className="-ml-0.5 mr-1 inline h-3 w-3" />}
								{lang === "vi" ? opt.labelVi : opt.labelEn}
							</button>
						))}
					</div>
				</div>

				{/* Platform */}
				<div className="space-y-2">
					<label className="font-medium text-sm">Platform (chọn 1)</label>
					<div className="flex flex-wrap gap-2">
						{PLATFORM_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setPlatformId(opt.id)}
								className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
									platformId === opt.id
										? "border-primary bg-primary text-primary-foreground"
										: "hover:bg-muted"
								}`}
							>
								{platformId === opt.id && <Check className="-ml-0.5 h-3 w-3" />}
								<span>{lang === "vi" ? opt.labelVi : opt.labelEn}</span>
								<Badge variant="secondary" className="text-xs">
									{opt.ratio}
								</Badge>
							</button>
						))}
					</div>
				</div>
			</section>

			{/* CTA */}
			{error && (
				<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
					<span>{error}</span>
				</div>
			)}
			{costUsd !== null && costUsd > 0 && (
				<p className="text-xs text-muted-foreground">
					LLM cost: ${costUsd.toFixed(4)} USD (DO Inference)
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => router.back()}
					disabled={submitting}
				>
					Quay lại config
				</Button>
				<Button
					type="button"
					onClick={handleBuild}
					disabled={submitting || audienceIds.size === 0 || lookFeelIds.size === 0}
					className="px-8"
				>
					<Sparkles className="mr-2 h-4 w-4" />
					{submitting ? "Đang queue build..." : "Build Video →"}
				</Button>
			</div>
		</div>
	);
}
