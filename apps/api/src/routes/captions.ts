/**
 * Caption AI routes — Sprint S16 (PW-14 Auto-captions VN).
 *
 * Editor "Caption AI" tool: user selects audio track segment OR full project
 * audio → POST here → ElevenLabs Scribe transcribes → returns subtitle segments
 * with word-level timestamps. Frontend inserts into Editor subtitle track.
 *
 * Two entry modes:
 *   1. Audio R2 key (already uploaded) — preferred for project tracks
 *   2. Multipart audio upload — preferred for one-off file
 *
 * Cost: ~$0.40/hr audio (charged via incrementVoicePreviews equivalent).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "../plugins/require-auth.js";
import { CAPTION_PRESETS, findCaptionPreset } from "../data/caption-presets.js";

interface CaptionWord {
	text: string;
	start: number;
	end: number;
}

interface CaptionResponse {
	segments: Array<{
		id: string;
		startSec: number;
		durationSec: number;
		text: string;
	}>;
	durationSec: number;
	costUsd: number;
	languageCode: string;
}

/**
 * Group word-level timestamps into ~3-7 second subtitle segments.
 * Break at sentence punctuation OR when running > 7s.
 */
function groupWordsToSegments(words: CaptionWord[]): CaptionResponse["segments"] {
	if (words.length === 0) return [];
	const segments: CaptionResponse["segments"] = [];
	let bucket: CaptionWord[] = [];
	let bucketStart = words[0]?.start ?? 0;
	const flush = () => {
		if (bucket.length === 0) return;
		const start = bucketStart;
		const end = bucket[bucket.length - 1]?.end ?? start;
		segments.push({
			id: `seg-${segments.length + 1}`,
			startSec: start,
			durationSec: Math.max(0.5, end - start),
			text: bucket.map((w) => w.text).join(" ").trim(),
		});
		bucket = [];
	};
	for (const w of words) {
		if (bucket.length === 0) bucketStart = w.start;
		bucket.push(w);
		const dur = w.end - bucketStart;
		const endsSentence = /[.?!。]$/.test(w.text);
		if (endsSentence || dur >= 6) {
			flush();
		}
	}
	flush();
	return segments;
}

export const captionsRoutes: FastifyPluginAsyncZod = async (app) => {
	// GET /api/captions/presets — list 8 VN-tuned subtitle styles (S17 PW-15).
	app.get("/presets", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { items: CAPTION_PRESETS };
		},
	});

	// GET /api/captions/presets/:id — single preset detail (style + ffmpeg force_style).
	app.get("/presets/:id", {
		schema: { params: z.object({ id: z.string() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const preset = findCaptionPreset(req.params.id);
			if (!preset) {
				reply.code(404);
				return { error: "Preset not found" };
			}
			return preset;
		},
	});

	// POST /api/captions/transcribe — Caption AI from R2 audio key.
	app.post("/transcribe", {
		schema: {
			body: z.object({
				audioR2Key: z.string().min(1),
				bucket: z.enum(["uploads", "derived"]).default("uploads"),
				languageCode: z.string().min(2).max(5).default("vi"),
				diarize: z.boolean().default(false),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!app.aiRouter) {
				reply.code(503);
				return { error: "AI router not configured" };
			}
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}

			const bucketName =
				req.body.bucket === "derived" ? app.r2Buckets.derived : app.r2Buckets.uploads;

			// Fetch audio from R2 → Blob (Scribe accepts up to 1GB, but typical
			// project audio is < 30MB).
			const obj = await app.r2.send(
				new GetObjectCommand({ Bucket: bucketName, Key: req.body.audioR2Key }),
			);
			if (!obj.Body) {
				reply.code(404);
				return { error: "Audio R2 object empty" };
			}
			const chunks: Uint8Array[] = [];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			for await (const chunk of obj.Body as any) chunks.push(chunk as Uint8Array);
			const buf = Buffer.concat(chunks);
			const audioBlob = new Blob([buf], { type: "audio/mpeg" });

			try {
				const { result } = await app.aiRouter.invoke(
					"stt.transcribe" as never,
					{
						audioBlob,
						languageCode: req.body.languageCode,
						diarize: req.body.diarize,
						timestampsGranularity: "word",
					} as never,
					{ tier: "pro", workspaceId: "", userId: user.id } as never,
				);
				const out = (result as {
					output?: { text?: string; languageCode?: string; words?: CaptionWord[] };
					costUsd?: number;
					durationMs?: number;
				});
				const words = out.output?.words ?? [];
				const segments = groupWordsToSegments(words);
				return {
					segments,
					durationSec: words.length > 0 ? words[words.length - 1]!.end : 0,
					costUsd: out.costUsd ?? 0,
					languageCode: out.output?.languageCode ?? req.body.languageCode,
				} satisfies CaptionResponse;
			} catch (err) {
				req.log.error(
					{ err: err instanceof Error ? err.message : String(err), userId: user.id },
					"caption transcribe failed",
				);
				reply.code(502);
				return {
					error: "Transcribe failed",
					message: err instanceof Error ? err.message : String(err),
				};
			}
		},
	});
};
