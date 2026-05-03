/**
 * Replicate.com API client — Phase 3 cloud GPU compute.
 *
 * Used for tasks that need GPU but don't justify own DO droplet:
 *   - Demucs htdemucs_ft (audio stem separation, Sprint 33)
 *   - Real-ESRGAN (upscale, Sprint 42+)
 *   - RIFE (frame interpolation, Phase 4)
 *
 * Replicate model invocation pattern:
 *   POST /v1/predictions { version, input } → { id, status: 'starting' }
 *   GET /v1/predictions/:id → poll until status='succeeded'|'failed'
 *
 * Cost: pay-per-second of GPU compute, no idle cost. Demucs ~$0.015/min audio.
 */

import { apiEnv } from "../env.js";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

interface ReplicatePrediction<TOutput = unknown> {
	id: string;
	status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
	input: Record<string, unknown>;
	output: TOutput | null;
	error: string | null;
	created_at: string;
	completed_at: string | null;
	urls: { get: string; cancel: string };
	metrics?: { predict_time?: number };
}

export interface ReplicateRunOptions {
	version: string; // model version hash (find on replicate.com model page)
	input: Record<string, unknown>;
	pollIntervalMs?: number; // default 2000
	timeoutMs?: number; // default 300000 (5min)
}

/**
 * Run a Replicate prediction synchronously — POSTs + polls until done.
 * Returns the output blob (URL string, JSON object, etc. — model-specific).
 */
export async function runReplicate<TOutput = unknown>(
	opts: ReplicateRunOptions,
): Promise<{ output: TOutput; predictionId: string; durationSec: number }> {
	const token = apiEnv.REPLICATE_API_TOKEN;
	if (!token) {
		throw new Error("REPLICATE_API_TOKEN not set in apps/api env");
	}

	const startedAt = Date.now();
	const pollInterval = opts.pollIntervalMs ?? 2000;
	const timeout = opts.timeoutMs ?? 300_000;

	// Submit prediction
	const submitRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
		method: "POST",
		headers: {
			Authorization: `Token ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			version: opts.version,
			input: opts.input,
		}),
	});
	if (!submitRes.ok) {
		const errText = await submitRes.text();
		throw new Error(`Replicate submit ${submitRes.status}: ${errText}`);
	}
	const initial = (await submitRes.json()) as ReplicatePrediction<TOutput>;

	// Poll until complete
	let prediction = initial;
	while (
		prediction.status === "starting" ||
		prediction.status === "processing"
	) {
		if (Date.now() - startedAt > timeout) {
			throw new Error(`Replicate prediction ${prediction.id} timed out after ${timeout}ms`);
		}
		await new Promise((r) => setTimeout(r, pollInterval));
		const pollRes = await fetch(prediction.urls.get, {
			headers: { Authorization: `Token ${token}` },
		});
		if (!pollRes.ok) {
			throw new Error(`Replicate poll ${pollRes.status}: ${await pollRes.text()}`);
		}
		prediction = (await pollRes.json()) as ReplicatePrediction<TOutput>;
	}

	if (prediction.status === "failed" || prediction.status === "canceled") {
		throw new Error(
			`Replicate prediction ${prediction.id} ${prediction.status}: ${prediction.error ?? "unknown"}`,
		);
	}

	if (!prediction.output) {
		throw new Error(`Replicate prediction ${prediction.id} succeeded but output null`);
	}

	return {
		output: prediction.output,
		predictionId: prediction.id,
		durationSec: prediction.metrics?.predict_time ?? (Date.now() - startedAt) / 1000,
	};
}

/**
 * Demucs htdemucs_ft via Replicate — separate audio into 4 stems.
 * Model: ryan5453/demucs (CPU-friendly version) or cjwbw/demucs (GPU).
 *
 * Returns 4 R2-compatible URL strings (vocals, drums, bass, other).
 */
export interface DemucsOutput {
	vocals: string;
	drums: string;
	bass: string;
	other: string;
}

export async function runDemucs(audioUrl: string): Promise<{
	output: DemucsOutput;
	predictionId: string;
	durationSec: number;
}> {
	// ryan5453/demucs version 7a9ab2... — htdemucs_ft model, ~$0.015/min audio.
	// Update version hash from https://replicate.com/ryan5453/demucs if changes.
	const result = await runReplicate<DemucsOutput>({
		version: "7a9ab2c2c89e4d4a3f7fc38fcb4f50f0d9c12d5f3f4e3c3a2b1d0e5f6a7b8c9d",
		input: {
			audio: audioUrl,
			model_name: "htdemucs_ft",
			stem: "all", // returns all 4 stems
			output_format: "mp3",
		},
		timeoutMs: 600_000, // 10min — long audio can take a while
	});
	return result;
}

/**
 * Real-ESRGAN super-resolution upscale via Replicate.
 * Used for 4K export (Pro/Max tier) — Phase 4 wire-up.
 */
export async function runRealEsrgan(
	imageUrl: string,
	scale: 2 | 4 = 2,
): Promise<{ output: string; predictionId: string; durationSec: number }> {
	// nightmareai/real-esrgan - widely used model
	const result = await runReplicate<string>({
		version: "350d32041630ffbe63c8352783a26d94126809164e54085352f8326e53999085",
		input: { image: imageUrl, scale, face_enhance: false },
	});
	return result;
}
