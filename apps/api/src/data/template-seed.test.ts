import { describe, expect, it } from "vitest";
import { TEMPLATE_SEED, findTemplateSeed } from "./template-seed.js";

const ALLOWED_WORKFLOW_IDS = [
	"ad-product-vn",
	"ugc-review-tiktok",
	"demo-product",
	"short-entertainment",
	"youtube-long-entertainment",
	"storytelling-cinematic",
	"tet-bundle",
	"script-to-video",
	"dropshipping-fb-ad",
] as const;

const ALLOWED_PLATFORMS = [
	"tiktok",
	"fb-feed",
	"fb-ad-vertical",
	"youtube-long",
	"youtube-shorts",
	"ig-reels",
] as const;

const ALLOWED_CATEGORIES = [
	"product-ad",
	"ugc-review",
	"tutorial",
	"trending",
	"seasonal",
	"entertainment",
] as const;

describe("TEMPLATE_SEED — S22 50 templates", () => {
	it("ships at least 50 templates", () => {
		expect(TEMPLATE_SEED.length).toBeGreaterThanOrEqual(50);
	});

	it("each template has unique id (kebab-case)", () => {
		const ids = TEMPLATE_SEED.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});

	it("each template references known workflow id", () => {
		for (const t of TEMPLATE_SEED) {
			expect(ALLOWED_WORKFLOW_IDS).toContain(t.workflowId);
		}
	});

	it("each template has valid platform + category", () => {
		for (const t of TEMPLATE_SEED) {
			expect(ALLOWED_PLATFORMS).toContain(t.platform);
			expect(ALLOWED_CATEGORIES).toContain(t.category);
		}
	});

	it("each template has hookLine + structure + ctaLine + suggestedChips + duration > 0", () => {
		for (const t of TEMPLATE_SEED) {
			expect(t.name.length).toBeGreaterThan(0);
			expect(t.preview.hookLine.length).toBeGreaterThan(0);
			expect(t.preview.structure.length).toBeGreaterThan(0);
			expect(t.preview.ctaLine.length).toBeGreaterThan(0);
			expect(t.suggestedChips.audiences.length).toBeGreaterThan(0);
			expect(t.suggestedChips.lookFeel.length).toBeGreaterThan(0);
			expect(t.durationSec).toBeGreaterThan(0);
		}
	});

	it("each template carries at least 1 tag", () => {
		for (const t of TEMPLATE_SEED) {
			expect(t.tags.length).toBeGreaterThan(0);
		}
	});

	it("all 6 categories represented (per S22 spec: 15 product-ad / 10 ugc / 10 tutorial / 8 trending / 5 seasonal / 2 entertainment)", () => {
		const present = new Set(TEMPLATE_SEED.map((t) => t.category));
		for (const c of ALLOWED_CATEGORIES) {
			expect(present.has(c)).toBe(true);
		}
	});
});

describe("findTemplateSeed", () => {
	it("returns template for valid id", () => {
		const sample = TEMPLATE_SEED[0]!;
		expect(findTemplateSeed(sample.id)?.id).toBe(sample.id);
	});

	it("returns undefined for unknown id", () => {
		expect(findTemplateSeed("nonexistent-template")).toBeUndefined();
	});
});
