/**
 * Quick Create — Workflow Picker (View 2 per SCOPE §3.2 + §13).
 *
 * 8 workflow cards + 3 Max plugins. Click → POST /api/quick-create/sessions
 * → navigate to /config?sessionId=X (View 3).
 */

"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Crown, Lock, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

interface WorkflowCard {
	id: string;
	name: string;
	nameEn: string;
	description: string;
	/** CSS gradient for thumbnail — replaces missing /quick-create/thumbnails/*.jpg files. */
	gradient: string;
	requiredTier: "standard" | "pro" | "max";
	platform: { ratio: string; defaultDurationSec: number };
	pace: "slow" | "medium" | "fast";
	seasonalLockout?: boolean;
}

// IDs MUST match backend workflowRegistry (packages/quick-create/src/templates/index.ts).
// Audit BUG #12: outline endpoint returns "Unknown workflow X" if frontend
// id ≠ registered template id. Frontend was using shorthand IDs that didn't
// exist on backend (reel-hook-3s, ugc-senior-vn, etc.).
const WORKFLOWS: WorkflowCard[] = [
	{
		id: "ad-product-vn",
		name: "Quảng cáo sản phẩm",
		nameEn: "Product Ad",
		description: "Video ads 30-60s 9:16 cho FB/TikTok creator chạy paid campaigns",
		gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 30 },
		pace: "fast",
	},
	{
		id: "ugc-review-tiktok",
		name: "UGC Review TikTok",
		nameEn: "UGC Review TikTok",
		description: "Authentic UGC review 30-45s — talking head + close-up demo",
		gradient: "linear-gradient(135deg, #F59E0B 0%, #DC2626 100%)",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 35 },
		pace: "medium",
	},
	{
		id: "demo-product",
		name: "Demo sản phẩm",
		nameEn: "Product Demo",
		description: "Video demo 60-120s 16:9 cho B2B / SaaS — clear narration",
		gradient: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
		requiredTier: "standard",
		platform: { ratio: "16:9", defaultDurationSec: 60 },
		pace: "medium",
	},
	{
		id: "short-entertainment",
		name: "Reel/Short giải trí",
		nameEn: "Short Entertainment",
		description: "Video giải trí 15-60s — viral hook, beat-sync, TikTok/Reel/Shorts",
		gradient: "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 30 },
		pace: "fast",
	},
	{
		id: "youtube-long-entertainment",
		name: "YouTube giải trí dài",
		nameEn: "YouTube Long-form",
		description: "Video dài 5-15min — storytelling narrative + intro/outro + chapter markers",
		gradient: "linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)",
		requiredTier: "standard",
		platform: { ratio: "16:9", defaultDurationSec: 480 },
		pace: "medium",
	},
	{
		id: "storytelling-cinematic",
		name: "Storytelling cinematic",
		nameEn: "Cinematic Storytelling",
		description: "Video cinematic 60-180s — slow pace, letterbox, Teal-Orange LUT",
		gradient: "linear-gradient(135deg, #1F2937 0%, #4B5563 100%)",
		requiredTier: "pro",
		platform: { ratio: "16:9", defaultDurationSec: 120 },
		pace: "slow",
	},
	{
		id: "tet-bundle",
		name: "Tết bundle",
		nameEn: "Lunar New Year Bundle",
		description: "Video Tết 30-60s — gold/red palette, Tết music, VN cultural assets",
		gradient: "linear-gradient(135deg, #FCD34D 0%, #DC2626 100%)",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 45 },
		pace: "medium",
		seasonalLockout: !isInTetWindow(new Date()),
	},
	{
		id: "script-to-video",
		name: "Script-to-Video",
		nameEn: "Script to Video",
		description: "Paste script → auto cut scenes by sentence + match stock + TTS",
		gradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 60 },
		pace: "medium",
	},
	{
		id: "dropshipping-fb-ad",
		name: "Dropshipping FB Ad",
		nameEn: "Dropshipping FB Ad",
		description: "EN cross-border FB ad 40-60s — 5-act structure (Hook + Demo + Lifestyle + Proof + CTA)",
		gradient: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
		requiredTier: "pro",
		platform: { ratio: "4:5", defaultDurationSec: 50 },
		pace: "fast",
	},
];

interface PluginCard {
	id: string;
	name: string;
	description: string;
}

const PLUGINS: PluginCard[] = [
	{
		id: "voice-clone",
		name: "Clone giọng",
		description: "ElevenLabs Instant Voice Cloning, max 5 voices/user",
	},
	{
		id: "brand-kit",
		name: "Brand kit",
		description: "Override watermark, intro/outro, color theme, typography",
	},
	{
		id: "stylization",
		name: "Stylization preset",
		description: "Predefined LUT + color grade áp dụng post-process",
	},
];

function isInTetWindow(now: Date): boolean {
	const month = now.getMonth() + 1;
	return month === 12 || month === 1 || month === 2;
}

const TIER_BADGE_LABEL: Record<WorkflowCard["requiredTier"], string> = {
	standard: "Standard",
	pro: "Pro",
	max: "Max",
};

interface WorkspaceRow {
	id: string;
	name: string;
}

interface SessionResponse {
	id: string;
}

interface CulturalBundle {
	id: string;
	holiday: "tet" | "trungthu" | "quockhanh" | "blackfriday";
	labelVi: string;
	emojiBadge: string;
	suggestedTemplateIds: string[];
}

export default function WorkflowsPage() {
	return (
		<Suspense
			fallback={
				<main className="flex min-h-screen items-center justify-center bg-background">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</main>
			}
		>
			<WorkflowsPageContent />
		</Suspense>
	);
}

function WorkflowsPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const promptFromHero = searchParams.get("prompt") ?? "";
	const attachmentKeysFromHero = (searchParams.get("attachments") ?? "")
		.split(",")
		.filter(Boolean);

	const [error, setError] = useState<string | null>(null);
	const [creatingId, setCreatingId] = useState<string | null>(null);
	const [seasonalBundles, setSeasonalBundles] = useState<CulturalBundle[]>([]);
	const [, startTransition] = useTransition();

	useEffect(() => {
		// Surface seasonal bundles active this month — Tết / Trung Thu / Quốc Khánh /
		// Black Friday. Fails silently if backend down or user not authed.
		apiFetch<{ items: CulturalBundle[] }>("/api/cultural-bundles/active")
			.then((data) => setSeasonalBundles(data.items ?? []))
			.catch(() => {});
	}, []);

	const handleSelect = async (workflowId: string) => {
		setError(null);
		setCreatingId(workflowId);
		try {
			const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
			const firstWs = ws.items[0];
			if (!firstWs) {
				router.push(`/login?next=${encodeURIComponent("/quick-create/workflows")}`);
				return;
			}
			const session = await apiFetch<SessionResponse>("/api/quick-create/sessions", {
				method: "POST",
				body: JSON.stringify({
					workspaceId: firstWs.id,
					mode: "pathA",
					prompt: promptFromHero,
					...(attachmentKeysFromHero.length > 0
						? { heroAttachmentR2Keys: attachmentKeysFromHero }
						: {}),
				}),
			});
			startTransition(() => {
				router.push(
					`/quick-create/workflows/${workflowId}/config?sessionId=${session.id}`,
				);
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Network error";
			if (msg.includes("401") || msg.includes("Unauthorized")) {
				router.push(`/login?next=${encodeURIComponent("/quick-create/workflows")}`);
				return;
			}
			setError(msg);
		} finally {
			setCreatingId(null);
		}
	};

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<Link
					href="/"
					className="mb-4 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Home
				</Link>

				<div className="mb-8 space-y-2">
					<h1 className="font-bold text-3xl tracking-tight">Choose a workflow</h1>
					<p className="text-muted-foreground">
						9 workflow tune sẵn cho creator Việt Nam · Standard / Pro / Max tier
					</p>
					{promptFromHero && (
						<p className="text-xs text-muted-foreground">
							Prompt từ Hero: <span className="italic">{promptFromHero.slice(0, 120)}{promptFromHero.length > 120 ? "..." : ""}</span>
						</p>
					)}
				</div>

				{error && (
					<div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{seasonalBundles.length > 0 && (
					<div className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-amber-200/40 bg-amber-50/40 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
						<span className="text-xs font-medium text-amber-700 dark:text-amber-300">
							Đang mùa
						</span>
						{seasonalBundles.map((b) => (
							<Badge key={b.id} variant="secondary" className="gap-1 text-xs">
								<span>{b.emojiBadge}</span>
								<span>{b.labelVi}</span>
							</Badge>
						))}
					</div>
				)}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{WORKFLOWS.map((wf) => {
						const blocked = wf.seasonalLockout;
						const busy = creatingId === wf.id;
						return (
							<button
								key={wf.id}
								type="button"
								disabled={blocked || busy}
								onClick={() => void handleSelect(wf.id)}
								className={`group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 ${
									blocked ? "" : "hover:border-primary"
								}`}
							>
								<div
									className="aspect-video w-full"
									style={{ background: wf.gradient }}
								/>
								<div className="space-y-2 p-4">
									<div className="flex items-start justify-between gap-2">
										<h3 className="font-semibold leading-tight">{wf.name}</h3>
										<div className="flex flex-shrink-0 items-center gap-1">
											{wf.requiredTier !== "standard" && (
												<Badge variant="secondary" className="flex items-center gap-1 text-xs">
													{wf.requiredTier === "max" && <Crown className="h-3 w-3" />}
													{TIER_BADGE_LABEL[wf.requiredTier]}
												</Badge>
											)}
											{wf.seasonalLockout && (
												<Badge variant="outline" className="text-xs">
													<Lock className="mr-1 h-3 w-3" />
													Seasonal
												</Badge>
											)}
										</div>
									</div>
									<p className="text-muted-foreground text-sm">{wf.description}</p>
									<div className="flex items-center gap-2 pt-1 text-muted-foreground text-xs">
										<span>{wf.platform.ratio}</span>
										<span>·</span>
										<span>{wf.platform.defaultDurationSec}s</span>
										<span>·</span>
										<span className="capitalize">{wf.pace} pace</span>
										{busy && (
											<>
												<span>·</span>
												<Loader2 className="h-3 w-3 animate-spin" />
												<span>Đang tạo session…</span>
											</>
										)}
									</div>
								</div>
							</button>
						);
					})}
				</div>

				<section className="mt-12 space-y-4 rounded-lg border bg-muted/20 p-6">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5" />
						<h2 className="font-semibold text-lg">Max plugins</h2>
						<Badge variant="secondary" className="flex items-center gap-1">
							<Crown className="h-3 w-3" />
							Max only
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm">
						3 plugins extend Quick Create cho Max users:
					</p>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						{PLUGINS.map((plugin) => (
							<button
								key={plugin.id}
								type="button"
								disabled
								className="flex flex-col gap-1 rounded-md border bg-card p-3 text-left opacity-60"
								title="Max tier required — Phase 1.5 wire-up"
							>
								<div className="flex items-center gap-1.5">
									<Crown className="h-3.5 w-3.5 text-amber-500" />
									<strong className="text-sm">{plugin.name}</strong>
								</div>
								<span className="text-xs text-muted-foreground">{plugin.description}</span>
							</button>
						))}
					</div>
					<p className="text-muted-foreground text-xs">
						Phase 1.5 (Sprint 6+) wire-up.
					</p>
				</section>
			</div>
		</main>
	);
}
