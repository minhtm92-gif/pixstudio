/**
 * Music library API — Sprint 24.
 *
 * GET /api/music — list tracks with mood/genre/duration/source filter
 * GET /api/music/:id — single track
 *
 * Phase 1.5 v1: serves static MUSIC_TRACKS catalog from src/data/.
 * Phase 2: move to DB-backed MusicTrack model + admin upload UI.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../plugins/require-auth.js";
import { MUSIC_TRACKS } from "../data/music-tracks.js";

export const musicRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/", {
		schema: {
			querystring: z.object({
				mood: z
					.enum(["upbeat", "chill", "cinematic", "epic", "comedic", "romantic", "tense", "corporate"])
					.optional(),
				genre: z
					.enum(["pop", "lo-fi", "edm", "rock", "acoustic", "ambient", "hip-hop", "orchestral"])
					.optional(),
				maxDurationSec: z.coerce.number().positive().optional(),
				source: z
					.enum(["FB_SOUND_COLLECTION", "TIKTOK_CREATIVE_CENTER", "YOUTUBE_AUDIO_LIB", "INTERNAL"])
					.optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			let items = MUSIC_TRACKS;
			if (req.query.mood) items = items.filter((t) => t.mood === req.query.mood);
			if (req.query.genre) items = items.filter((t) => t.genre === req.query.genre);
			if (req.query.maxDurationSec)
				items = items.filter((t) => t.durationSec <= req.query.maxDurationSec!);
			if (req.query.source) items = items.filter((t) => t.source === req.query.source);
			return {
				items,
				total: items.length,
				note: "Audio R2 keys null until admin upload (Sprint 25+).",
			};
		},
	});

	app.get("/:id", {
		schema: { params: z.object({ id: z.string() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const track = MUSIC_TRACKS.find((t) => t.id === req.params.id);
			if (!track) {
				reply.code(404);
				return { error: "Track not found" };
			}
			return track;
		},
	});
};
