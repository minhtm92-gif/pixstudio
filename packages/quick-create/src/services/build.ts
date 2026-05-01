/**
 * Build pipeline service — Phase 1 Sprint 2 wire-up.
 *
 * Orchestrates: script → tts → stock match → compose → render via BullMQ workers.
 */

import type { BuildEvent, QuickCreateSession } from "../types.js";

export interface BuildInput {
	session: QuickCreateSession;
	emitEvent: (event: BuildEvent) => void | Promise<void>;
}

export interface BuildOutput {
	projectId: string;
	thumbnailUrl: string;
	totalDurationSec: number;
	totalCostUsd: number;
}

/** Build stages in execution order */
const STAGES = [
	{ id: "generating-script", label: "Generating script", weight: 10 },
	{ id: "synthesizing-voice", label: "Synthesizing voice (ElevenLabs)", weight: 25 },
	{ id: "matching-stock", label: "Matching stock media", weight: 20 },
	{ id: "composing-scenes", label: "Composing scenes", weight: 20 },
	{ id: "rendering-preview", label: "Rendering preview", weight: 25 },
] as const;

export class BuildService {
	/** Phase 1 Sprint 2 implementation. Currently stubbed. */
	async run(input: BuildInput): Promise<BuildOutput> {
		const { session, emitEvent } = input;

		if (!session.outline) {
			throw new Error("Cannot build without outline");
		}

		let cumulativeProgress = 0;

		// Stage 1: Generating script (refine outline scripts to TTS-ready text)
		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "generating-script",
			progress: cumulativeProgress,
			etaSec: 60,
		});
		// TODO: refine outline.scenes[].script via LLM (handle pronunciations, abbreviations)
		cumulativeProgress += STAGES[0].weight;

		// Stage 2: Synthesize voice per scene (incremental TTS, parallelized)
		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "synthesizing-voice",
			progress: cumulativeProgress,
		});
		// TODO: for each scene, call elevenlabs-tts → save R2 → return r2Key
		// Parallelize via Promise.all with concurrency limit
		cumulativeProgress += STAGES[1].weight;

		// Stage 3: Match stock media per scene
		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "matching-stock",
			progress: cumulativeProgress,
		});
		// TODO: for each scene, search admin stock pool by mediaQuery
		// Pick top-1 candidate, license + download to R2
		cumulativeProgress += STAGES[2].weight;

		// Stage 4: Compose scenes (timeline JSON, transitions, subtitle overlays)
		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "composing-scenes",
			progress: cumulativeProgress,
		});
		// TODO: build OpenCut compositor JSON → save as project
		cumulativeProgress += STAGES[3].weight;

		// Stage 5: Render preview MP4 (low-res for fast feedback, full res on Export)
		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "rendering-preview",
			progress: cumulativeProgress,
		});
		// TODO: invoke Rust compositor → MP4 720p draft
		cumulativeProgress = 100;

		await emitEvent({
			type: "status-change",
			sessionId: session.id,
			status: "completed",
			progress: 100,
		});

		throw new Error("BuildService.run not yet implemented (Phase 1 Sprint 2)");
	}

	/** Cancel in-flight build (only pre-stage 3, after that costs incurred) */
	async cancel(sessionId: string): Promise<void> {
		// TODO: BullMQ job remove + cleanup partial assets R2
		throw new Error(`BuildService.cancel(${sessionId}) not yet implemented`);
	}
}
