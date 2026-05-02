/**
 * Workflow: UGC Review TikTok (UC1 — VN ecom buyer, 30-45s).
 *
 * Casual UGC-style product reviews — talking-head + product close-ups.
 * Default VN, dropdown override EN. Does NOT fire Crossian RAG.
 */

import type { WorkflowTemplate } from "../types.js";

const ugcReviewTiktok: WorkflowTemplate = {
	id: "ugc-review-tiktok",
	name: "UGC Review TikTok",
	nameEn: "UGC Review TikTok",
	description: "Authentic UGC review video 30-45s — talking head + close-up demo cho người mua online VN",
	thumbnail: "/quick-create/thumbnails/ugc-review-tiktok.jpg",
	pace: "medium",
	defaultLanguage: "vi",
	platform: {
		ratio: "9:16",
		minDurationSec: 20,
		maxDurationSec: 60,
		defaultDurationSec: 35,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN female casual 25y
		voiceName: "VN Female Casual",
		speed: 1.05,
		stability: 0.40,
		similarityBoost: 0.70,
	},
	subtitleStyle: {
		font: "Montserrat",
		fontSize: 48,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 3,
		animation: "typewriter",
		position: "bottom",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["lo-fi", "indie", "vlog"],
		mood: ["casual", "friendly"],
	},
	samplePrompts: [
		"Em vừa thử serum vitamin C của hãng X, em tả lại trải nghiệm da em sau 7 ngày — hook 3s 'Da em đẹp lên hẳn', show trước/sau, recommend 4.5/5 sao",
		"Review máy hút bụi cầm tay 200K — em test trên thảm + ghế sofa nhà em, voice over như đang nói chuyện với bạn, ending 'shop link bio'",
		"Unbox + review tai nghe bluetooth giá rẻ — em mở hộp, đeo thử, test pin, so sánh với AirPods — kết luận 'đáng tiền không'",
	],
	requiredTier: "standard",
	inputMode: "prompt",
	tags: ["review", "ugc"], // does NOT fire Crossian RAG
};

export default ugcReviewTiktok;
