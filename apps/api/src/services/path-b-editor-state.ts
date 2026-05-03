/**
 * Path B editor state builder — shared between auto-trigger (quick-create.ts)
 * and admin handoff (path-b.ts).
 *
 * Produces the `{ timeline: { scenes, audio, duration } }` schema that the
 * Quick Create Editor 3-tab UI (View 6 per SCOPE §13) reads via
 * `useEditorState(projectId)` → `editorStateJson["timeline"]["scenes"]`.
 *
 * NOT the OpenCut Pro Workspace `{ tracks: [video, audio, subtitle] }` shape —
 * that adapter is Sprint 41 future work.
 */

import type { PathBExtraction } from "./path-b-pipeline.js";

export interface PathBEditorState {
	version: number;
	title: string;
	duration: number;
	sourceVideoR2Key: string;
	timeline: {
		scenes: Array<{
			id: string;
			order: number;
			startSec: number;
			durationSec: number;
			script: string;
			mediaQuery: string;
			mood: string | null;
			objects: string[];
			sourceTrim: { fromSec: number; toSec: number };
		}>;
		audio: {
			r2Key: string;
			stems: PathBExtraction["stems"] | null;
		};
		duration: number;
	};
	extractionMeta: {
		sceneCount: number;
		transcriptSegments: number;
		visualAnalyzed: number;
		hasStems: boolean;
	};
}

export function buildPathBEditorState(ext: PathBExtraction): PathBEditorState {
	const totalDuration = ext.scenes.reduce((s, sc) => s + sc.durationSec, 0);

	// Map transcript segments to scenes by overlapping time range.
	const scenes = ext.scenes.map((sc, idx) => {
		const overlapping = ext.transcript.filter(
			(t) => t.start < sc.endSec && t.end > sc.startSec,
		);
		const script = overlapping.map((t) => t.text).join(" ").trim();
		const visual = ext.visualAnalysis.find((v) => v.sceneId === sc.id);
		return {
			id: sc.id,
			order: idx + 1,
			startSec: sc.startSec,
			durationSec: sc.durationSec,
			script,
			mediaQuery: visual?.description ?? "",
			mood: visual?.mood ?? null,
			objects: visual?.objects ?? [],
			sourceTrim: { fromSec: sc.startSec, toSec: sc.endSec },
		};
	});

	return {
		version: 1,
		title: "Reverse engineered from reference",
		duration: totalDuration,
		sourceVideoR2Key: ext.videoR2Key,
		timeline: {
			scenes,
			audio: {
				r2Key: ext.audioR2Key,
				stems: ext.stems ?? null,
			},
			duration: totalDuration,
		},
		extractionMeta: {
			sceneCount: ext.scenes.length,
			transcriptSegments: ext.transcript.length,
			visualAnalyzed: ext.visualAnalysis.length,
			hasStems: !!ext.stems,
		},
	};
}

/**
 * Convert seconds to minutes for quota tracking (round up to be conservative).
 */
export function secondsToQuotaMinutes(totalSec: number): number {
	return Math.ceil(totalSec / 60);
}
