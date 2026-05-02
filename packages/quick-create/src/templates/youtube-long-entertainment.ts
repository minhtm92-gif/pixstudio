/**
 * Workflow: YouTube Long Entertainment (UC3 — VN viewer 5-15min).
 *
 * Storytelling cho audience giải trí dài. Intro/outro markers + chapter splits.
 * Default VN per Q40c. Dropdown override available.
 */

import type { WorkflowTemplate } from "../types.js";

const youtubeLongEntertainment: WorkflowTemplate = {
	id: "youtube-long-entertainment",
	name: "YouTube giải trí dài",
	nameEn: "YouTube Long Entertainment",
	description: "Video giải trí dài 5-15min 16:9 — storytelling narrative + intro/outro + chapter markers cho YouTube VN viewers",
	thumbnail: "/quick-create/thumbnails/youtube-long-entertainment.jpg",
	pace: "medium",
	defaultLanguage: "vi",
	platform: {
		ratio: "16:9",
		minDurationSec: 300, // 5min min
		maxDurationSec: 900, // 15min cap v1
		defaultDurationSec: 480, // 8min
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN male warm storyteller
		voiceName: "VN Male Storyteller Warm",
		speed: 0.95,
		stability: 0.55,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Inter",
		fontSize: 32,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 2,
		animation: "fade-in",
		position: "bottom",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato", "Shutterstock"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["cinematic", "indie", "instrumental"],
		mood: ["uplifting", "narrative"],
	},
	samplePrompts: [
		"Câu chuyện về chàng trai bỏ phố lên núi 5 năm — 10 phút narrative, intro 30s hook, 5 chapters: lý do bỏ, ngày đầu, khó khăn, học được, cuộc sống nay",
		"Top 10 món ăn đường phố Sài Gòn — 8 phút food vlog, mỗi món 45s với close-up + interview cô bán hàng",
		"Tôi thử sống không điện thoại 7 ngày — vlog 12 phút day-by-day journal, lessons learned outro 1min",
	],
	requiredTier: "standard",
	inputMode: "prompt",
	tags: ["entertainment", "narrative"],
	chapterMarkers: true,
	introOutro: true,
};

export default youtubeLongEntertainment;
