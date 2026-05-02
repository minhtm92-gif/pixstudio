/**
 * Quick Create — Workflow Picker (View 2, Phase 1 Sprint 1 Story 1.2).
 *
 * 8 workflow cards, click → View 3 config modal.
 * Server integration Sprint 2 (GET /api/quick-create/workflows).
 *
 * For now: hardcoded list mirrors `packages/quick-create/src/templates/`.
 * After Sprint 2 wire-up, fetch from API and filter by user tier + seasonal lockout.
 */

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
	title: "Browse Workflows · Quick Create · PixStudio",
	description: "8 workflow tune sẵn cho creator Việt Nam.",
};

interface WorkflowCard {
	id: string;
	name: string;
	nameEn: string;
	description: string;
	thumbnail: string;
	requiredTier: "standard" | "pro" | "max";
	platform: { ratio: string; defaultDurationSec: number };
	pace: "slow" | "medium" | "fast";
	/** Workflow scaffold ready, template content lands in a future sprint. */
	disabled?: boolean;
	/** True when current date is outside Tết window (Dec–Feb). */
	seasonalLockout?: boolean;
}

const WORKFLOWS_PHASE_1_LAUNCH: WorkflowCard[] = [
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
		disabled: true,
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
		disabled: true,
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
		disabled: true,
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
		disabled: true,
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
		disabled: true,
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
		disabled: true,
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
		disabled: true,
	},
];

function isInTetWindow(now: Date): boolean {
	const month = now.getMonth() + 1; // 1-12
	return month === 12 || month === 1 || month === 2;
}

const TIER_BADGE_LABEL: Record<WorkflowCard["requiredTier"], string> = {
	standard: "Standard",
	pro: "Pro",
	max: "Max",
};

export default function WorkflowsPage() {
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-6xl px-4 py-8">
				{/* Breadcrumb */}
				<Link
					href="/quick-create"
					className="mb-4 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Quick Create
				</Link>

				{/* Header */}
				<div className="mb-8 space-y-2">
					<h1 className="font-bold text-3xl tracking-tight">
						Choose a workflow
					</h1>
					<p className="text-muted-foreground">
						9 workflow tune sẵn cho creator Việt Nam · Standard / Pro / Max tier
					</p>
				</div>

				{/* Grid */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{WORKFLOWS_PHASE_1_LAUNCH.map((wf) => {
						const blocked = wf.disabled || wf.seasonalLockout;
						return (
							<button
								key={wf.id}
								type="button"
								disabled={blocked}
								className={`group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 ${
									blocked ? "" : "hover:border-primary"
								}`}
							>
								{/* Thumbnail */}
								<div
									className="aspect-video w-full bg-gradient-to-br from-muted to-muted-foreground/20 bg-cover bg-center"
									style={{ backgroundImage: `url(${wf.thumbnail})` }}
								/>

								{/* Content */}
								<div className="space-y-2 p-4">
									<div className="flex items-start justify-between gap-2">
										<h3 className="font-semibold leading-tight">{wf.name}</h3>
										<div className="flex flex-shrink-0 items-center gap-1">
											{wf.requiredTier !== "standard" && (
												<Badge
													variant="secondary"
													className="flex items-center gap-1 text-xs"
												>
													{wf.requiredTier === "max" && (
														<Crown className="h-3 w-3" />
													)}
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
									<p className="text-muted-foreground text-sm">
										{wf.description}
									</p>
									<div className="flex items-center gap-2 pt-1 text-muted-foreground text-xs">
										<span>{wf.platform.ratio}</span>
										<span>·</span>
										<span>{wf.platform.defaultDurationSec}s</span>
										<span>·</span>
										<span className="capitalize">{wf.pace} pace</span>
									</div>
									{wf.disabled && (
										<p className="pt-2 text-amber-600 text-xs dark:text-amber-400">
											Coming soon — template content lands next sprint.
										</p>
									)}
								</div>
							</button>
						);
					})}
				</div>

				{/* Plugin section (Max tier only) */}
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
					<ul className="space-y-1 text-sm">
						<li>
							<strong>Clone giọng</strong> — ElevenLabs Instant Voice Cloning,
							max 5 voices/user
						</li>
						<li>
							<strong>Brand kit</strong> — override watermark, intro/outro,
							color theme, typography
						</li>
						<li>
							<strong>Stylization preset</strong> — predefined LUT + color grade
							áp dụng post-process
						</li>
					</ul>
					<p className="text-muted-foreground text-xs">
						Phase 1.5 (Sprint 6+) wire-up.
					</p>
				</section>
			</div>
		</main>
	);
}
