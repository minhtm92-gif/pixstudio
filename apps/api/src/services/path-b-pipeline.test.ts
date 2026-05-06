import { describe, expect, it } from "vitest";
import { mergeShortScenes } from "./path-b-pipeline.js";
import type { SceneBoundary } from "./path-b-pipeline.js";

function makeScene(order: number, startSec: number, endSec: number): SceneBoundary {
	return {
		id: `scene-${order}`,
		order,
		startSec,
		endSec,
		durationSec: endSec - startSec,
	};
}

describe("mergeShortScenes — B3 fix", () => {
	it("returns empty for empty input", () => {
		expect(mergeShortScenes([])).toEqual([]);
	});

	it("returns single scene unchanged (no merge target)", () => {
		const input = [makeScene(1, 0, 3)];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(1);
		expect(out[0]?.durationSec).toBe(3);
	});

	it("keeps scenes ≥ 5s untouched", () => {
		const input = [
			makeScene(1, 0, 6),
			makeScene(2, 6, 12),
			makeScene(3, 12, 20),
		];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(3);
		expect(out.map((s) => s.durationSec)).toEqual([6, 6, 8]);
	});

	it("merges short scene into preceding long scene", () => {
		const input = [
			makeScene(1, 0, 8), // long
			makeScene(2, 8, 10), // short 2s → merge
			makeScene(3, 10, 16), // long
		];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(2);
		expect(out[0]?.durationSec).toBe(10); // 0 → 10
		expect(out[1]?.durationSec).toBe(6); // 10 → 16
	});

	it("merges multiple consecutive short scenes into preceding long", () => {
		const input = [
			makeScene(1, 0, 6),
			makeScene(2, 6, 8),
			makeScene(3, 8, 9),
			makeScene(4, 9, 11),
			makeScene(5, 11, 18),
		];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(2);
		expect(out[0]?.durationSec).toBe(11); // 0 → 11 absorbs 3 shorts
		expect(out[1]?.durationSec).toBe(7); // 11 → 18
	});

	it("preserves first scene even if short (no preceding to merge into)", () => {
		const input = [makeScene(1, 0, 2), makeScene(2, 2, 8)];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(2);
		expect(out[0]?.startSec).toBe(0);
		expect(out[0]?.durationSec).toBe(2);
	});

	it("re-numbers id and order after merge", () => {
		const input = [
			makeScene(1, 0, 6),
			makeScene(2, 6, 7),
			makeScene(3, 7, 13),
			makeScene(4, 13, 14),
			makeScene(5, 14, 20),
		];
		const out = mergeShortScenes(input);
		expect(out).toHaveLength(3);
		expect(out.map((s) => s.id)).toEqual(["scene-1", "scene-2", "scene-3"]);
		expect(out.map((s) => s.order)).toEqual([1, 2, 3]);
	});

	it("handles realistic 16-min storytelling case (366 raw → ~60 merged)", () => {
		// Simulate raw output: 366 short scenes alternating 1.5s, 2s, 3s, 0.8s
		const totalDuration = 962;
		const input: SceneBoundary[] = [];
		let t = 0;
		const pattern = [1.5, 2, 3, 0.8];
		let i = 0;
		while (t < totalDuration && input.length < 366) {
			const dur = pattern[i % pattern.length] ?? 2;
			input.push(makeScene(input.length + 1, t, t + dur));
			t += dur;
			i++;
		}
		const out = mergeShortScenes(input);
		// Total duration preserved
		const lastEnd = out[out.length - 1]?.endSec ?? 0;
		expect(Math.abs(lastEnd - input[input.length - 1]!.endSec)).toBeLessThan(0.01);
		// Scene count drops dramatically — all merged scenes ≥ 5s except possibly first.
		expect(out.length).toBeLessThan(input.length / 4);
		// Every merged scene (except possibly the first) is ≥ 5s
		for (let k = 1; k < out.length; k++) {
			expect(out[k]!.durationSec).toBeGreaterThanOrEqual(5);
		}
	});
});
