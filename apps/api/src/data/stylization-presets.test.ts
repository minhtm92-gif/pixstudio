import { describe, expect, it } from "vitest";
import {
	STYLIZATION_PRESETS,
	findStylizationPreset,
} from "./stylization-presets.js";

describe("STYLIZATION_PRESETS — S30 8 ComfyUI AnimateDiff presets", () => {
	it("ships at least 8 presets", () => {
		expect(STYLIZATION_PRESETS.length).toBeGreaterThanOrEqual(8);
	});

	it("each preset has unique id (kebab-case)", () => {
		const ids = STYLIZATION_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});

	it("each preset has bilingual labels + thumbnail + prompt + workflow file", () => {
		for (const p of STYLIZATION_PRESETS) {
			expect(p.labelVi.length).toBeGreaterThan(0);
			expect(p.labelEn.length).toBeGreaterThan(0);
			expect(p.thumbnailUrl).toMatch(/^https?:\/\//);
			expect(p.promptKeyword.length).toBeGreaterThan(0);
			expect(p.workflowFile).toMatch(/\.json$/);
		}
	});

	it("each preset has positive cost + valid tier", () => {
		for (const p of STYLIZATION_PRESETS) {
			expect(p.costPerSecUsd).toBeGreaterThan(0);
			expect(["pro", "max"]).toContain(p.requiredTier);
		}
	});
});

describe("findStylizationPreset", () => {
	it("returns preset for valid id", () => {
		const sample = STYLIZATION_PRESETS[0]!;
		expect(findStylizationPreset(sample.id)?.id).toBe(sample.id);
	});

	it("returns undefined for unknown id", () => {
		expect(findStylizationPreset("nonexistent-preset")).toBeUndefined();
	});
});
