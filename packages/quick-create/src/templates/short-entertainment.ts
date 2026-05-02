/**
 * Workflow: Short Entertainment (UC4 — TikTok/Reel/Shorts giải trí 15-60s).
 *
 * Fast-paced viral content. Hook 1s, strong beat-sync, comedy/dramatic.
 */

import type { WorkflowTemplate } from "../types.js";

const shortEntertainment: WorkflowTemplate = {
	id: "short-entertainment",
	name: "Reel/Short giải trí",
	nameEn: "Short Entertainment",
	description: "Video giải trí ngắn 15-60s 9:16 — viral hook, beat-sync, comedy/dramatic cho TikTok/Reel/Shorts",
	thumbnail: "/quick-create/thumbnails/short-entertainment.jpg",
	pace: "fast",
	defaultLanguage: "vi",
	platform: {
		ratio: "9:16",
		minDurationSec: 15,
		maxDurationSec: 60,
		defaultDurationSec: 30,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN female playful / hype
		voiceName: "VN Female Playful",
		speed: 1.10,
		stability: 0.35,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Bebas Neue",
		fontSize: 64,
		fontColor: "#FFFF00",
		strokeColor: "#000000",
		strokeWidth: 4,
		animation: "scale-pop",
		position: "center",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["pop", "trap", "viral-tiktok"],
		mood: ["energetic", "fun"],
	},
	samplePrompts: [
		"Top 5 sự thật bất ngờ về cà phê Việt Nam — hook 1s 'Bạn nghĩ uống cà phê tỉnh ngủ?', kết câu twist hài hước 30s",
		"POV: Khi chó nhà bạn trộm được sandwich — story comedic 25s, narrator giả giọng chó tinh nghịch",
		"Dramatic reveal: Tôi đã ăn pizza 30 ngày liền — body change reveal cuối với meme music",
	],
	requiredTier: "standard",
	inputMode: "prompt",
	tags: ["entertainment"], // does NOT fire Crossian RAG
};

export default shortEntertainment;
