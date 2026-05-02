/**
 * Workflow: Script-to-Video (utility — paste raw script, auto-cut scenes).
 *
 * No defaultLanguage strict — flexible. inputMode = "script-paste" thay vì prompt.
 * Scene split by sentence boundary.
 */

import type { WorkflowTemplate } from "../types.js";

const scriptToVideo: WorkflowTemplate = {
	id: "script-to-video",
	name: "Script-to-Video",
	nameEn: "Script-to-Video",
	description: "Paste script → auto cut scenes by sentence + match stock + TTS — flexible duration, any platform",
	thumbnail: "/quick-create/thumbnails/script-to-video.jpg",
	pace: "medium",
	defaultLanguage: "vi",
	platform: {
		ratio: "9:16", // default 9:16, user override
		minDurationSec: 15,
		maxDurationSec: 600,
		defaultDurationSec: 60,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME",
		voiceName: "VN Female Default",
		speed: 1.0,
		stability: 0.5,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Inter",
		fontSize: 42,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 2,
		animation: "fade-in",
		position: "bottom",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato"],
	musicSourcePolicy: "library-or-uploaded",
	musicLibraryFilter: {
		genre: ["pop", "ambient"],
		mood: ["neutral"],
	},
	samplePrompts: [
		"[Paste full script ở đây — system auto-detect câu thoại, split scenes theo dấu chấm, match stock cho mỗi câu]",
		"Đoạn script: 'Xin chào các bạn. Hôm nay tôi review máy lọc nước RO. Sản phẩm có 7 cấp lọc. Giá 5 triệu. Mua tại link bio.' → 5 scenes auto split",
	],
	requiredTier: "standard",
	inputMode: "script-paste",
	sceneSplitStrategy: "sentence",
	maxScriptLength: 5000,
	tags: ["utility"],
};

export default scriptToVideo;
