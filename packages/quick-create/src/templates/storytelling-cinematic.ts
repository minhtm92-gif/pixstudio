/**
 * Workflow: Storytelling Cinematic (narrative + dramatic, 60-180s).
 *
 * Slow pace, cinematic LUT (Teal-Orange), letterbox, dramatic music.
 */

import type { WorkflowTemplate } from "../types.js";

const storytellingCinematic: WorkflowTemplate = {
	id: "storytelling-cinematic",
	name: "Storytelling cinematic",
	nameEn: "Storytelling Cinematic",
	description: "Video kể chuyện cinematic 60-180s 16:9 — slow pace, letterbox, Teal-Orange LUT, dramatic music",
	thumbnail: "/quick-create/thumbnails/storytelling-cinematic.jpg",
	pace: "slow",
	defaultLanguage: "vi",
	platform: {
		ratio: "16:9",
		minDurationSec: 30,
		maxDurationSec: 300,
		defaultDurationSec: 120,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN male narrator deep
		voiceName: "VN Male Narrator Deep",
		speed: 0.90,
		stability: 0.65,
		similarityBoost: 0.80,
	},
	subtitleStyle: {
		font: "Inter",
		fontSize: 30,
		fontColor: "#F5F5DC",
		strokeColor: "#000000",
		strokeWidth: 2,
		animation: "fade-in",
		position: "bottom",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato", "Shutterstock"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["orchestral", "cinematic", "epic"],
		mood: ["dramatic", "emotional"],
	},
	visualStyle: {
		lut: "Teal-Orange",
		letterbox: true,
		filmGrain: "subtle",
	},
	samplePrompts: [
		"Câu chuyện 2 phút về một người nông dân lưu giữ nghề làm nón lá truyền thống — hook silent close-up tay đan, narrate cuộc đời, ending sunset",
		"3 phút phim ngắn về thành phố Sài Gòn lúc 5h sáng — slow montage chợ, xe đẩy, phở mở cửa, mặt người lao động",
		"Cinematic recap 90s chuyến leo Phan Xi Păng — first time, lý do, hành trình, summit, lessons",
	],
	requiredTier: "pro",
	inputMode: "prompt",
	tags: ["narrative", "entertainment"],
};

export default storytellingCinematic;
