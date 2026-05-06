import { describe, expect, it } from "vitest";
import { CAPTION_PRESETS, findCaptionPreset } from "./caption-presets.js";

describe("CAPTION_PRESETS — S17 8 VN-tuned presets", () => {
	it("ships at least 8 presets", () => {
		expect(CAPTION_PRESETS.length).toBeGreaterThanOrEqual(8);
	});

	it("each preset has unique id", () => {
		const ids = CAPTION_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("each preset has non-empty VN + EN labels", () => {
		for (const p of CAPTION_PRESETS) {
			expect(p.labelVi.length).toBeGreaterThan(0);
			expect(p.labelEn.length).toBeGreaterThan(0);
		}
	});

	it("each preset has valid editor style fields", () => {
		for (const p of CAPTION_PRESETS) {
			expect(p.editor.font.length).toBeGreaterThan(0);
			expect(p.editor.size).toBeGreaterThan(0);
			// Color must be hex (#RRGGBB or #RRGGBBAA)
			expect(p.editor.color).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
			expect(p.editor.strokeColor).toMatch(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
			expect(p.editor.strokeWidth).toBeGreaterThanOrEqual(0);
		}
	});

	it("each preset has FFmpeg force_style with required keys", () => {
		for (const p of CAPTION_PRESETS) {
			// FFmpeg subtitles filter force_style requires at least Fontname + FontSize +
			// PrimaryColour. Render Stage 5 + Path B editor state both depend on these.
			expect(p.ffmpegForceStyle).toContain("Fontname=");
			expect(p.ffmpegForceStyle).toContain("FontSize=");
			expect(p.ffmpegForceStyle).toContain("PrimaryColour=");
		}
	});

	it("findCaptionPreset returns preset for valid id", () => {
		const tiktok = findCaptionPreset("tiktok-bold");
		expect(tiktok).toBeDefined();
		expect(tiktok?.id).toBe("tiktok-bold");
	});

	it("findCaptionPreset returns undefined for unknown id", () => {
		expect(findCaptionPreset("nonexistent-preset")).toBeUndefined();
	});

	it("uses kebab-case ids (frontend URL-safe)", () => {
		for (const p of CAPTION_PRESETS) {
			expect(p.id).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});
});
