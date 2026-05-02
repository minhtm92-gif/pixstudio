/**
 * Workflow: Demo Product (B2B / SaaS feature walkthrough, 60-120s).
 *
 * Screen-record + voiceover style. 16:9 default. Clear narration, không sales-y.
 */

import type { WorkflowTemplate } from "../types.js";

const demoProduct: WorkflowTemplate = {
	id: "demo-product",
	name: "Demo sản phẩm",
	nameEn: "Demo Product",
	description: "Video demo tính năng sản phẩm 60-120s 16:9 cho B2B / SaaS — clear narration, screen capture style",
	thumbnail: "/quick-create/thumbnails/demo-product.jpg",
	pace: "medium",
	defaultLanguage: "vi",
	platform: {
		ratio: "16:9",
		minDurationSec: 30,
		maxDurationSec: 180,
		defaultDurationSec: 60,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // VN male clear professional
		voiceName: "VN Male B2B Clear",
		speed: 1.0,
		stability: 0.55,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Inter",
		fontSize: 36,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 2,
		animation: "fade-in",
		position: "bottom",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["corporate", "ambient"],
		mood: ["professional", "uplifting"],
	},
	samplePrompts: [
		"Demo 90s tính năng auto-export PDF của ứng dụng X — show 3 use cases: hợp đồng, báo cáo, slide pitch. Voiceover hướng dẫn step-by-step",
		"Walkthrough 60s tool quản lý tồn kho — show dashboard, add SKU, low-stock alert, integration với Shopify. Audience: chủ shop online",
		"Demo 2 phút SaaS tính lương — workflow upload Excel → tự động tính thuế + bảo hiểm → export pay slip PDF",
	],
	requiredTier: "standard",
	inputMode: "prompt",
	tags: ["demo", "b2b"],
};

export default demoProduct;
