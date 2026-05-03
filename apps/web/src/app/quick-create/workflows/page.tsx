/**
 * Quick Create — Workflow Picker (View 2 per SCOPE §3.2 + §13).
 *
 * 8 workflow cards + 3 Max plugins. Click → POST /api/quick-create/sessions
 * → navigate to /config?sessionId=X (View 3).
 */

"use client";

import { Suspense, useState, useTransition } from "react";
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
	thumbnail: string;
	requiredTier: "standard" | "pro" | "max";
	platform: { ratio: string; defaultDurationSec: number };
	pace: "slow" | "medium" | "fast";
	seasonalLockout?: boolean;
}

const WORKFLOWS: WorkflowCard[] = [
	{
		id: "ad-product-vn",
		name: "Quảng cáo sản phẩm",
		nameEn: "Product Ad",
		description: "Video ads 30-60s 9:16 cho FB/TikTok creator",
		thumbnail: "/quick-create/thumbnails/ad-product-vn.jpg",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 30 },
		pace: "fast",
	},
	{
		id: "ugc-senior-vn",
		name: "UGC Senior 50+",
		nameEn: "UGC Senior 50+",
		description: "Pace chậm, voice ấm — segment Senior VN",
		thumbnail: "/quick-create/thumbnails/ugc-senior-vn.jpg",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 45 },
		pace: "slow",
	},
	{
		id: "demo-product",
		name: "Demo sản phẩm",
		nameEn: "Product Demo",
		description: "Voice rõ ràng, layout 16:9 hoặc 9:16",
		thumbnail: "/quick-create/thumbnails/demo-product.jpg",
		requiredTier: "standard",
		platform: { ratio: "16:9", defaultDurationSec: 60 },
		pace: "medium",
	},
	{
		id: "reel-hook-3s",
		name: "Reel ngắn (Hook 3s)",
		nameEn: "Short Reel",
		description: "Hook 3s + music beat-sync · TikTok / Reels / Shorts",
		thumbnail: "/quick-create/thumbnails/reel-hook-3s.jpg",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 15 },
		pace: "fast",
	},
	{
		id: "youtube-long",
		name: "YouTube long",
		nameEn: "YouTube Long-form",
		description: "5-15 phút · chapter markers · intro/outro",
		thumbnail: "/quick-create/thumbnails/youtube-long.jpg",
		requiredTier: "pro",
		platform: { ratio: "16:9", defaultDurationSec: 600 },
		pace: "medium",
	},
	{
		id: "storytelling-cinematic",
		name: "Storytelling Cinematic",
		nameEn: "Cinematic Storytelling",
		description: "LUT cinematic · letterbox · ambient music",
		thumbnail: "/quick-create/thumbnails/storytelling.jpg",
		requiredTier: "pro",
		platform: { ratio: "16:9", defaultDurationSec: 120 },
		pace: "slow",
	},
	{
		id: "tet-bundle-vn",
		name: "Tết bundle",
		nameEn: "Lunar New Year Bundle",
		description: "Stock pool tết · gold/red palette · traditional VN music",
		thumbnail: "/quick-create/thumbnails/tet-bundle-vn.jpg",
		requiredTier: "standard",
		platform: { ratio: "9:16", defaultDurationSec: 30 },
		pace: "medium",
		seasonalLockout: !isInTetWindow(new Date()),
	},
	{
		id: "script-to-video",
		name: "Script-to-Video",
		nameEn: "Script to Video",
		description: "Paste script → auto cut scenes incremental TTS",
		thumbnail: "/quick-create/thumbnails/script-to-video.jpg",
		requiredTier: "pro",
		platform: { ratio: "9:16", defaultDurationSec: 60 },
		pace: "medium",
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

	const [error, setError] = useState<string | null>(null);
	const [creatingId, setCreatingId] = useState<string | null>(null);
	const [, startTransition] = useTransition();

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
						8 workflow tune sẵn cho creator Việt Nam · Standard / Pro / Max tier
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
									className="aspect-video w-full bg-gradient-to-br from-muted to-muted-foreground/20 bg-cover bg-center"
									style={{ backgroundImage: `url(${wf.thumbnail})` }}
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
