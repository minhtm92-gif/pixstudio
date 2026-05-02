/**
 * Workflow template: Quảng cáo sản phẩm (Product Ad — Vietnamese).
 *
 * Sample/reference template — anh use as pattern fill 7 other workflows
 * theo `docs/quick-create/workflow-templates-form.md`.
 *
 * Voice ID will resolve at runtime via VoiceCacheEntry registry (Phase 1 Sprint 2).
 * For now, points to ElevenLabs marketplace voice slug "vn-female-young-pop"
 * — em fetch real ElevenLabs voiceId via /api/voices?lang=vi&gender=female cron sync.
 */

import type { WorkflowTemplate } from "../types.js";

const adProductVn: WorkflowTemplate = {
	id: "ad-product-vn",
	name: "Quảng cáo sản phẩm",
	nameEn: "Product Ad",
	description: "Video ads 30-60s 9:16 cho FB/TikTok creator chạy paid campaigns",
	thumbnail: "/quick-create/thumbnails/ad-product-vn.jpg", // Phase 1 Sprint 1 design
	pace: "fast",
	defaultLanguage: "vi",
	platform: {
		ratio: "9:16",
		minDurationSec: 15,
		maxDurationSec: 60,
		defaultDurationSec: 30,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // resolved from VoiceCacheEntry tagged use_case=ad-narrator
		voiceName: "VN Young Female (Pop)",
		speed: 1.05,
		stability: 0.45,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Bebas Neue",
		fontSize: 56,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 3,
		animation: "scale-pop",
		position: "center",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato", "Shutterstock"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["pop", "electronic", "trap"],
		mood: ["energetic", "happy"],
	},
	samplePrompts: [
		"Quảng cáo serum chống nắng SPF 50+ cho da dầu mụn — target nữ 18-30, hook 3s đầu tập trung benefit",
		"Reel giới thiệu set son lì 6 màu giá 199K — pose tốc độ + close-up texture, ending CTA 'mua ngay link bio'",
		"Demo nhanh máy hút bụi cầm tay — split screen before/after, voice over thuyết phục giá rẻ chất lượng cao",
	],
	requiredTier: "standard",
	inputMode: "prompt",
};

export default adProductVn;
