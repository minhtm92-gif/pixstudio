/**
 * Workflow: Dropshipping FB Ad (UC2 — cross-border EN, 40-60s).
 *
 * THIS WORKFLOW FIRES CROSSIAN RAG when language=en (Q72 chốt).
 * Sample prompts mocked from Crossian KB `Knowhow_for_AI_Agent/05_Video_Analysis/`
 * 5-act structure: Hook (0-3s) → Product Intro (3-7s) → Demo (7-15s) →
 * Lifestyle (15-35s) → Social Proof + CTA (35-60s).
 */

import type { WorkflowTemplate } from "../types.js";

const dropshippingFbAd: WorkflowTemplate = {
	id: "dropshipping-fb-ad",
	name: "Dropshipping FB Ad",
	nameEn: "Dropshipping FB Ad",
	description: "EN cross-border FB ad 40-60s — 5-act Crossian structure with Hook + Demo + Lifestyle + Social Proof + CTA",
	thumbnail: "/quick-create/thumbnails/dropshipping-fb-ad.jpg",
	pace: "medium",
	defaultLanguage: "en",
	platform: {
		ratio: "4:5", // FB Ad vertical
		minDurationSec: 40,
		maxDurationSec: 60,
		defaultDurationSec: 50,
	},
	voice: {
		voiceId: "REPLACE_AT_RUNTIME", // EN female persuasion 30y
		voiceName: "EN Female Persuasion",
		speed: 1.0,
		stability: 0.50,
		similarityBoost: 0.75,
	},
	subtitleStyle: {
		font: "Bebas Neue",
		fontSize: 64,
		fontColor: "#FFFFFF",
		strokeColor: "#000000",
		strokeWidth: 4,
		animation: "scale-pop",
		position: "center",
	},
	watermarkPosition: "bottom-right",
	stockSources: ["iStock", "Envato", "Shutterstock"],
	musicSourcePolicy: "library-only",
	musicLibraryFilter: {
		genre: ["pop", "electronic", "uplifting"],
		mood: ["urgent", "energetic", "emotional-pull"],
	},
	samplePrompts: [
		// UC2 sample prompts từ Crossian patterns (5-act structure)
		"Make a 50-second FB ad for ergonomic back support cushion targeting office workers with chronic back pain. Hook variant: emotional. Show pain, solution demo, lifestyle, 4.8★ reviews, 50% OFF Today CTA.",
		"Create a 50s dropshipping ad for premium 4-way stretch men's pants for senior 50-70. Use 'My Dad Almost Cried' hook. 8 scenes: emotional reaction, unbox close-up, stretch demo, fit demo, breathable demo, lifestyle 4 activities, 50% OFF, 4.8★ + Shop Now.",
		"50s FB ad for adjustable posture-correcting bra for women 50+. Pain-point hook 'Tired of bras that dig into your shoulders?'. Show problem, solution mechanics, before/after lift, 'Shop Now' CTA with reviews 4.7★.",
	],
	requiredTier: "pro", // dropshipping ads = Pro tier feature
	inputMode: "prompt",
	tags: ["dropshipping", "facebook-ad"], // ← FIRES CROSSIAN RAG when language=en (Q72)
};

export default dropshippingFbAd;
