/**
 * Workflow: Tết Bundle (Vietnamese Lunar New Year, 30-60s).
 *
 * Seasonal lockout T11-T2 (Q19 chốt). Gold/red palette + Tết music + VN cultural assets.
 */

import type { WorkflowTemplate } from "../types.js";

const tetBundle: WorkflowTemplate = {
	id: "tet-bundle",
	name: "Tết bundle",
	nameEn: "Tet Bundle (VN Lunar New Year)",
	description: "Video Tết VN 30-60s — gold/red palette, Tết music, VN cultural assets. Visible T11-T2 (4 tháng prep window)",
	thumbnail: "/quick-create/thumbnails/tet-bundle.jpg",
	pace: "medium",
	defaultLanguage: "vi",
	platform: {
		ratio: "9:16",
		minDurationSec: 15,
		maxDurationSec: 90,
		defaultDurationSec: 45,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN female warm welcoming
		voiceName: "VN Female Warm",
		speed: 1.0,
		stability: 0.55,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Pacifico",
		fontSize: 56,
		fontColor: "#FFD700", // gold
		strokeColor: "#8B0000", // deep red
		strokeWidth: 3,
		animation: "scale-pop",
		position: "center",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock-tet-pool", "Envato-tet-pool"], // dedicated Tết stock pool
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["traditional-vn", "tet"],
		mood: ["festive", "warm", "family"],
	},
	visualStyle: {
		lut: "Gold-Red-Tet",
		letterbox: false,
		filmGrain: "none",
	},
	samplePrompts: [
		"Quảng cáo 30s set quà Tết cho doanh nghiệp tặng nhân viên — gold-red palette, opening múa lân, các giỏ quà display, ending CTA mua sỉ",
		"Reel 45s lời chúc Tết Giáp Thìn từ shop online — gia đình sum vầy, bánh chưng, trẻ em mừng tuổi, brand logo gold animated",
		"Video 60s 'Top 5 món ăn Tết miền Bắc' — close-up bánh chưng, giò lụa, dưa hành, thịt đông, mứt — voice over chia sẻ ý nghĩa",
	],
	requiredTier: "standard",
	inputMode: "prompt",
	tags: ["seasonal", "vn-cultural"],
	seasonalLockout: {
		startMonth: 11, // T11
		endMonth: 2, // T2
	},
};

export default tetBundle;
