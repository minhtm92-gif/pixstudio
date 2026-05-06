import { describe, expect, it } from "vitest";
import {
	buildPathBEditorState,
	secondsToQuotaMinutes,
} from "./path-b-editor-state.js";
import type { PathBExtraction } from "./path-b-pipeline.js";

function makeExtraction(overrides: Partial<PathBExtraction> = {}): PathBExtraction {
	return {
		videoR2Key: "path-b/test/source.mp4",
		audioR2Key: "path-b/test/source.mp3",
		scenes: [
			{ id: "scene-1", order: 1, startSec: 0, endSec: 10, durationSec: 10 },
			{ id: "scene-2", order: 2, startSec: 10, endSec: 20, durationSec: 10 },
		],
		transcript: [],
		visualAnalysis: [],
		...overrides,
	};
}

describe("secondsToQuotaMinutes", () => {
	it("rounds up partial minutes", () => {
		expect(secondsToQuotaMinutes(0)).toBe(0);
		expect(secondsToQuotaMinutes(1)).toBe(1);
		expect(secondsToQuotaMinutes(59)).toBe(1);
		expect(secondsToQuotaMinutes(60)).toBe(1);
		expect(secondsToQuotaMinutes(61)).toBe(2);
		expect(secondsToQuotaMinutes(962)).toBe(17); // 16:02 video
	});
});

describe("buildPathBEditorState", () => {
	it("builds minimal state from extraction with no transcript / visual", () => {
		const state = buildPathBEditorState(makeExtraction());
		expect(state.version).toBe(1);
		expect(state.duration).toBe(20);
		expect(state.sourceVideoR2Key).toBe("path-b/test/source.mp4");
		expect(state.timeline.scenes).toHaveLength(2);
		expect(state.timeline.audio.r2Key).toBe("path-b/test/source.mp3");
		expect(state.timeline.audio.stems).toBeNull();
		expect(state.extractionMeta.hasStems).toBe(false);
		expect(state.extractionMeta.transcriptSegments).toBe(0);
	});

	it("re-numbers scene order from 1", () => {
		const state = buildPathBEditorState(
			makeExtraction({
				scenes: [
					{ id: "scene-7", order: 7, startSec: 0, endSec: 5, durationSec: 5 },
					{ id: "scene-9", order: 9, startSec: 5, endSec: 10, durationSec: 5 },
				],
			}),
		);
		expect(state.timeline.scenes.map((s) => s.order)).toEqual([1, 2]);
		// Original ids preserved (not renamed by builder)
		expect(state.timeline.scenes.map((s) => s.id)).toEqual(["scene-7", "scene-9"]);
	});

	it("aligns transcript segments to overlapping scenes", () => {
		const state = buildPathBEditorState(
			makeExtraction({
				transcript: [
					{ start: 0, end: 5, text: "Hello world" },
					{ start: 5, end: 10, text: "this is scene one continued" },
					{ start: 10, end: 15, text: "scene two starts here" },
					{ start: 15, end: 20, text: "and ends here" },
				],
			}),
		);
		expect(state.timeline.scenes[0]?.script).toBe(
			"Hello world this is scene one continued",
		);
		expect(state.timeline.scenes[1]?.script).toBe(
			"scene two starts here and ends here",
		);
	});

	it("merges visual analysis by sceneId", () => {
		const state = buildPathBEditorState(
			makeExtraction({
				visualAnalysis: [
					{
						sceneId: "scene-1",
						description: "A cat on a beach",
						mood: "chill",
						objects: ["cat", "beach", "sand"],
					},
					{
						sceneId: "scene-2",
						description: "Storm clouds gathering",
						mood: "tense",
						objects: ["clouds", "lightning"],
					},
				],
			}),
		);
		expect(state.timeline.scenes[0]?.mediaQuery).toBe("A cat on a beach");
		expect(state.timeline.scenes[0]?.mood).toBe("chill");
		expect(state.timeline.scenes[0]?.objects).toEqual(["cat", "beach", "sand"]);
		expect(state.timeline.scenes[1]?.mood).toBe("tense");
	});

	it("falls back to empty mediaQuery / null mood when visual analysis missing", () => {
		const state = buildPathBEditorState(
			makeExtraction({
				visualAnalysis: [
					{
						sceneId: "scene-1",
						description: "Only first scene analyzed",
						mood: "epic",
						objects: ["fire"],
					},
				],
			}),
		);
		expect(state.timeline.scenes[0]?.mediaQuery).toBe("Only first scene analyzed");
		expect(state.timeline.scenes[1]?.mediaQuery).toBe("");
		expect(state.timeline.scenes[1]?.mood).toBeNull();
		expect(state.timeline.scenes[1]?.objects).toEqual([]);
	});

	it("propagates stems if present", () => {
		const stems = {
			vocals: "https://r/vocals.mp3",
			drums: "https://r/drums.mp3",
			bass: "https://r/bass.mp3",
			other: "https://r/other.mp3",
		};
		const state = buildPathBEditorState(makeExtraction({ stems }));
		expect(state.timeline.audio.stems).toEqual(stems);
		expect(state.extractionMeta.hasStems).toBe(true);
	});

	it("preserves sourceTrim with original scene boundaries", () => {
		const state = buildPathBEditorState(
			makeExtraction({
				scenes: [
					{ id: "scene-1", order: 1, startSec: 12.5, endSec: 18.75, durationSec: 6.25 },
				],
			}),
		);
		expect(state.timeline.scenes[0]?.sourceTrim).toEqual({
			fromSec: 12.5,
			toSec: 18.75,
		});
	});

	it("computes total duration from scene durations not original endSec", () => {
		// Scenes with gap (e.g. trimmed): duration = sum of durationSec, not last endSec
		const state = buildPathBEditorState(
			makeExtraction({
				scenes: [
					{ id: "a", order: 1, startSec: 0, endSec: 5, durationSec: 5 },
					{ id: "b", order: 2, startSec: 100, endSec: 110, durationSec: 10 },
				],
			}),
		);
		expect(state.duration).toBe(15); // 5 + 10
		expect(state.timeline.duration).toBe(15);
	});
});
