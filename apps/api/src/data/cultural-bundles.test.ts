import { describe, expect, it } from "vitest";
import {
	CULTURAL_BUNDLES,
	findCulturalBundle,
	getActiveBundlesForMonth,
} from "./cultural-bundles.js";

describe("CULTURAL_BUNDLES — S32 4 VN bundles", () => {
	it("ships 4 bundles (Tết / Trung Thu / Quốc Khánh / Black Friday)", () => {
		expect(CULTURAL_BUNDLES.length).toBeGreaterThanOrEqual(4);
		const holidays = CULTURAL_BUNDLES.map((b) => b.holiday);
		expect(holidays).toContain("tet");
		expect(holidays).toContain("trungthu");
		expect(holidays).toContain("quockhanh");
		expect(holidays).toContain("blackfriday");
	});

	it("each bundle has unique id", () => {
		const ids = CULTURAL_BUNDLES.map((b) => b.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("each bundle has bilingual labels + emoji + valid month range", () => {
		for (const b of CULTURAL_BUNDLES) {
			expect(b.labelVi.length).toBeGreaterThan(0);
			expect(b.labelEn.length).toBeGreaterThan(0);
			expect(b.emojiBadge.length).toBeGreaterThan(0);
			expect(b.monthsActive.length).toBeGreaterThan(0);
			for (const m of b.monthsActive) {
				expect(m).toBeGreaterThanOrEqual(1);
				expect(m).toBeLessThanOrEqual(12);
			}
		}
	});

	it("colorPalette is non-empty hex array", () => {
		for (const b of CULTURAL_BUNDLES) {
			expect(b.colorPalette.length).toBeGreaterThan(0);
			for (const c of b.colorPalette) {
				expect(c).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
			}
		}
	});
});

describe("findCulturalBundle", () => {
	it("returns bundle for valid id", () => {
		const sample = CULTURAL_BUNDLES[0]!;
		expect(findCulturalBundle(sample.id)?.id).toBe(sample.id);
	});

	it("returns undefined for unknown id", () => {
		expect(findCulturalBundle("nonexistent-bundle")).toBeUndefined();
	});
});

describe("getActiveBundlesForMonth", () => {
	it("returns Tết bundle in December (month 12)", () => {
		const dec = getActiveBundlesForMonth(12);
		expect(dec.some((b) => b.holiday === "tet")).toBe(true);
	});

	it("returns Trung Thu bundle in September (month 9)", () => {
		const sep = getActiveBundlesForMonth(9);
		expect(sep.some((b) => b.holiday === "trungthu")).toBe(true);
	});

	it("returns Black Friday bundle in November (month 11)", () => {
		const nov = getActiveBundlesForMonth(11);
		expect(nov.some((b) => b.holiday === "blackfriday")).toBe(true);
	});

	it("returns empty for off-season month (e.g. month 5 = no bundle)", () => {
		const may = getActiveBundlesForMonth(5);
		expect(may).toEqual([]);
	});
});
