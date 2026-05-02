/**
 * Voice library API — full ElevenLabs marketplace import + UI preview.
 *
 * Per docs/quick-create/voice-library-form.md (anh feedback 2026-05-02 #5).
 *
 * Endpoints:
 *   GET  /api/voices?lang=vi&gender=female&page=1&pageSize=50
 *   GET  /api/voices/:voiceId
 *   POST /api/voices/:voiceId/preview { text }
 *
 * Sprint 3: VoiceCacheEntry Prisma model + cron sync stub.
 * Sprint 4: voice cloning Max tier + RBAC quotas.
 *
 * Phase 1 Sprint 2.5 ship: routes returning ElevenLabs proxy data, no DB cache yet.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";

const ListVoicesQuerySchema = z.object({
	lang: z.string().optional(),
	gender: z.enum(["male", "female", "neutral"]).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const VoiceIdParamsSchema = z.object({ voiceId: z.string().min(1) });

const PreviewBodySchema = z.object({ text: z.string().min(1).max(100) });

interface ElevenLabsVoice {
	voice_id: string;
	name: string;
	preview_url?: string;
	category?: string;
	labels?: Record<string, string>;
}

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/** In-memory cache cho list voices (1h TTL). Sprint 3 move to Upstash Redis. */
let voicesCacheAt = 0;
let voicesCache: ElevenLabsVoice[] = [];
const VOICES_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
	if (Date.now() - voicesCacheAt < VOICES_CACHE_TTL_MS && voicesCache.length > 0) {
		return voicesCache;
	}
	const resp = await fetch(`${ELEVENLABS_BASE}/voices`, {
		headers: { "xi-api-key": apiKey },
	});
	if (!resp.ok) {
		throw new Error(`ElevenLabs /voices ${resp.status}: ${await resp.text()}`);
	}
	const json = (await resp.json()) as { voices: ElevenLabsVoice[] };
	voicesCache = json.voices ?? [];
	voicesCacheAt = Date.now();
	return voicesCache;
}

interface VoiceCardSchema {
	voiceId: string;
	name: string;
	previewUrl: string | null;
	category: string;
	gender: string | null;
	age: string | null;
	useCase: string | null;
	language: string | null;
	accent: string | null;
}

function shapeVoice(v: ElevenLabsVoice): VoiceCardSchema {
	const labels = v.labels ?? {};
	const lang = labels["language"] ?? labels["accent"] ?? null;
	return {
		voiceId: v.voice_id,
		name: v.name,
		previewUrl: v.preview_url ?? null,
		category: v.category ?? "premade",
		gender: labels["gender"] ?? null,
		age: labels["age"] ?? null,
		useCase: labels["use_case"] ?? labels["description"] ?? null,
		language: lang,
		accent: labels["accent"] ?? null,
	};
}

export const voicesRoutes: FastifyPluginAsyncZod = async (app) => {
	const apiKey = process.env["ELEVENLABS_API_KEY"];

	app.get("/", {
		schema: { querystring: ListVoicesQuerySchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;

			if (!apiKey) {
				reply.status(503);
				return { error: "ELEVENLABS_API_KEY not configured" };
			}

			let voices: ElevenLabsVoice[];
			try {
				voices = await fetchElevenLabsVoices(apiKey);
			} catch (err) {
				req.log.error({ err }, "ElevenLabs voices fetch failed");
				reply.status(502);
				return { error: "ElevenLabs upstream error" };
			}

			let filtered = voices.map(shapeVoice);
			if (req.query.lang) {
				const needle = req.query.lang.toLowerCase();
				filtered = filtered.filter(
					(v) =>
						v.language?.toLowerCase().includes(needle) ||
						v.accent?.toLowerCase().includes(needle),
				);
			}
			if (req.query.gender) {
				filtered = filtered.filter((v) => v.gender === req.query.gender);
			}

			const total = filtered.length;
			const start = (req.query.page - 1) * req.query.pageSize;
			const items = filtered.slice(start, start + req.query.pageSize);

			return {
				items,
				pagination: {
					page: req.query.page,
					pageSize: req.query.pageSize,
					total,
					totalPages: Math.ceil(total / req.query.pageSize),
				},
				cachedAt: new Date(voicesCacheAt).toISOString(),
			};
		},
	});

	app.get("/:voiceId", {
		schema: { params: VoiceIdParamsSchema },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!apiKey) {
				reply.status(503);
				return { error: "ELEVENLABS_API_KEY not configured" };
			}

			let voices: ElevenLabsVoice[];
			try {
				voices = await fetchElevenLabsVoices(apiKey);
			} catch (err) {
				req.log.error({ err }, "ElevenLabs voices fetch failed");
				reply.status(502);
				return { error: "ElevenLabs upstream error" };
			}

			const found = voices.find((v) => v.voice_id === req.params.voiceId);
			if (!found) {
				reply.status(404);
				return { error: "Voice not found" };
			}
			return shapeVoice(found);
		},
	});

	// Custom preview — generate ad-hoc TTS. Cost ~$0.0003 per 100 char preview.
	// Rate limit per user implicit via global rate-limit plugin (100/min).
	app.post("/:voiceId/preview", {
		schema: {
			params: VoiceIdParamsSchema,
			body: PreviewBodySchema,
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			if (!apiKey) {
				reply.status(503);
				return { error: "ELEVENLABS_API_KEY not configured" };
			}

			const startedAt = Date.now();
			const resp = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${req.params.voiceId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"xi-api-key": apiKey,
					Accept: "audio/mpeg",
				},
				body: JSON.stringify({
					text: req.body.text,
					model_id: "eleven_multilingual_v2",
					voice_settings: { stability: 0.5, similarity_boost: 0.75 },
				}),
			});

			if (!resp.ok) {
				const errText = await resp.text();
				req.log.error({ status: resp.status, errText }, "ElevenLabs TTS preview failed");
				reply.status(502);
				return { error: "ElevenLabs upstream error", status: resp.status };
			}

			const audio = Buffer.from(await resp.arrayBuffer());
			const durationMs = Date.now() - startedAt;
			req.log.info(
				{ voiceId: req.params.voiceId, sizeBytes: audio.length, durationMs },
				"voice preview generated",
			);

			reply
				.header("Content-Type", "audio/mpeg")
				.header("X-Cost-Usd", String(req.body.text.length * 0.000003))
				.header("X-Duration-Ms", String(durationMs));
			return audio;
		},
	});
};
