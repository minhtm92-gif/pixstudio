/**
 * Path B reverse engineer pipeline — Phase 1 Sprint 5 wire-up.
 *
 * Pipeline (per SCOPE.md §13):
 *   1. download + extract audio (FFmpeg)
 *   2. detect scenes (PySceneDetect)
 *   3. separate audio stems (Demucs htdemucs_ft)
 *   4. transcribe voice (ElevenLabs Scribe)
 *   5. identify music (Chromaprint)
 *   6. analyze visuals (Gemini 2.5 Pro multimodal)
 *   7. build editor state
 *
 * GPU spawn orchestration: auto-spawn DO L40S/RTX 6000 from snapshot 226870948,
 * destroy 30min idle.
 *
 * Cost ~$0.07-0.10/phút reference video.
 */

import type { ReverseEngineerJob } from "../types.js";

export interface ReverseEngineerInput {
	jobId: string;
	source: ReverseEngineerJob["source"];
	emitProgress: (job: ReverseEngineerJob) => void | Promise<void>;
}

/** Stub for now. Real impl Phase 1 Sprint 5. */
export class ReverseEngineerService {
	async run(input: ReverseEngineerInput): Promise<ReverseEngineerJob> {
		throw new Error("ReverseEngineerService.run not yet implemented (Phase 1 Sprint 5)");

		// Pseudocode for Sprint 5:
		// const job: ReverseEngineerJob = await this.initJob(input);
		// await this.ensureGpuRunning();
		//
		// // Stage 1: Download + extract audio
		// const { videoR2Key, audioR2Key } = await this.runStage("download", () =>
		//   this.ffmpegExtract(input.source)
		// );
		// await input.emitProgress(job);
		//
		// // Stage 2: Scene detection
		// const scenes = await this.runStage("sceneDetect", () =>
		//   this.runPySceneDetect(videoR2Key)
		// );
		// await input.emitProgress(job);
		//
		// // Stage 3: Audio stem separation (parallel-safe with stage 4)
		// const stems = await this.runStage("audioStems", () =>
		//   this.runDemucs(audioR2Key)
		// );
		// // Stage 4: Transcribe voice (parallel with stage 5)
		// const segments = await this.runStage("transcribe", () =>
		//   this.runElevenLabsScribe(stems.voice)
		// );
		// // Stage 5: Music match (uses non-voice stems)
		// const candidates = await this.runStage("musicMatch", () =>
		//   this.runChromaprintMatch(stems.drums, stems.bass, stems.other)
		// );
		// await input.emitProgress(job);
		//
		// // Stage 6: Visual analysis per scene
		// const perScene = await this.runStage("visualAnalysis", () =>
		//   this.runGeminiMultimodal(scenes, videoR2Key)
		// );
		// await input.emitProgress(job);
		//
		// // Stage 7: Build editor state
		// const projectId = await this.runStage("buildEditorState", () =>
		//   this.assembleEditorProject({ scenes, segments, perScene, candidates })
		// );
		//
		// await input.emitProgress(job);
		// return job;
	}

	// Helper stubs (Phase 1 Sprint 5)
	// private async ensureGpuRunning(): Promise<void> { ... }
	// private async ffmpegExtract(source): Promise<{ videoR2Key, audioR2Key }> { ... }
	// private async runPySceneDetect(videoR2Key): Promise<Scene[]> { ... }
	// private async runDemucs(audioR2Key): Promise<Stems> { ... }
	// private async runElevenLabsScribe(voiceR2Key): Promise<Segment[]> { ... }
	// private async runChromaprintMatch(drumsR2Key, bassR2Key, otherR2Key): Promise<Candidate[]> { ... }
	// private async runGeminiMultimodal(scenes, videoR2Key): Promise<PerScene[]> { ... }
	// private async assembleEditorProject(data): Promise<string> { ... }
}
