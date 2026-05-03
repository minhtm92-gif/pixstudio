/**
 * Music library catalog — Sprint 24 seed.
 *
 * Phase 1.5 v1: 10 hand-curated tracks with metadata only (mood/genre/duration
 * /licenseSource). Audio file R2 keys null until admin uploads via separate
 * flow (Sprint 25+ admin music upload UI).
 *
 * License sources allowed for PixStudio (per Q33-37):
 *   - FB_SOUND_COLLECTION: Free for FB ads (anh Minh confirms ToS)
 *   - TIKTOK_CREATIVE_CENTER: Free for TikTok ads
 *   - YOUTUBE_AUDIO_LIB: Free for any video
 *   - INTERNAL: Custom uploaded by admin (anh's library)
 *
 * Phase 2: scrape real tracks via vendor APIs (FB Sound Collection has
 * no public API — manual curation OR scrape with respectful rate limit).
 */

export type MusicMood =
	| "upbeat"
	| "chill"
	| "cinematic"
	| "epic"
	| "comedic"
	| "romantic"
	| "tense"
	| "corporate";

export type MusicGenre =
	| "pop"
	| "lo-fi"
	| "edm"
	| "rock"
	| "acoustic"
	| "ambient"
	| "hip-hop"
	| "orchestral";

export type MusicSource =
	| "FB_SOUND_COLLECTION"
	| "TIKTOK_CREATIVE_CENTER"
	| "YOUTUBE_AUDIO_LIB"
	| "INTERNAL";

export interface MusicTrack {
	id: string;
	title: string;
	artist: string;
	mood: MusicMood;
	genre: MusicGenre;
	durationSec: number;
	bpm: number;
	source: MusicSource;
	/** Filename pattern for upload — e.g. "fb-sound-collection/upbeat-01-summer-vibes.mp3" */
	expectedR2Key: string;
	/** Set after admin upload via Sprint 25+ flow */
	r2Key: string | null;
	tags: string[];
	useCases: string[];
	licenseAttribution: string | null;
}

export const MUSIC_TRACKS: MusicTrack[] = [
	{
		id: "track-001",
		title: "Summer Vibes",
		artist: "FB Sound Collection",
		mood: "upbeat",
		genre: "pop",
		durationSec: 30,
		bpm: 120,
		source: "FB_SOUND_COLLECTION",
		expectedR2Key: "music/fb-sound-collection/upbeat-pop-30s.mp3",
		r2Key: null,
		tags: ["summer", "happy", "energetic", "feel-good"],
		useCases: ["dropshipping ad", "fashion reel", "lifestyle UGC"],
		licenseAttribution: null,
	},
	{
		id: "track-002",
		title: "Lo-fi Coffee Shop",
		artist: "TikTok Creative Center",
		mood: "chill",
		genre: "lo-fi",
		durationSec: 60,
		bpm: 80,
		source: "TIKTOK_CREATIVE_CENTER",
		expectedR2Key: "music/tiktok-cc/chill-lofi-60s.mp3",
		r2Key: null,
		tags: ["coffee", "study", "calm", "background"],
		useCases: ["YouTube long-form intro", "tutorial bg", "vlog"],
		licenseAttribution: null,
	},
	{
		id: "track-003",
		title: "Epic Trailer Build",
		artist: "YouTube Audio Library",
		mood: "epic",
		genre: "orchestral",
		durationSec: 60,
		bpm: 100,
		source: "YOUTUBE_AUDIO_LIB",
		expectedR2Key: "music/yt-audio-lib/epic-orchestral-60s.mp3",
		r2Key: null,
		tags: ["trailer", "drama", "build-up", "dramatic"],
		useCases: ["product launch", "cinematic ad", "brand reveal"],
		licenseAttribution: null,
	},
	{
		id: "track-004",
		title: "Corporate Brightline",
		artist: "FB Sound Collection",
		mood: "corporate",
		genre: "acoustic",
		durationSec: 45,
		bpm: 95,
		source: "FB_SOUND_COLLECTION",
		expectedR2Key: "music/fb-sound-collection/corporate-acoustic-45s.mp3",
		r2Key: null,
		tags: ["corporate", "trust", "professional"],
		useCases: ["B2B ad", "company intro", "case study video"],
		licenseAttribution: null,
	},
	{
		id: "track-005",
		title: "EDM Drop High",
		artist: "TikTok Creative Center",
		mood: "epic",
		genre: "edm",
		durationSec: 30,
		bpm: 128,
		source: "TIKTOK_CREATIVE_CENTER",
		expectedR2Key: "music/tiktok-cc/edm-drop-30s.mp3",
		r2Key: null,
		tags: ["drop", "festival", "energy", "tiktok-trending"],
		useCases: ["TikTok hook", "fitness content", "fashion drop"],
		licenseAttribution: null,
	},
	{
		id: "track-006",
		title: "Romantic Sunset",
		artist: "YouTube Audio Library",
		mood: "romantic",
		genre: "acoustic",
		durationSec: 60,
		bpm: 75,
		source: "YOUTUBE_AUDIO_LIB",
		expectedR2Key: "music/yt-audio-lib/romantic-acoustic-60s.mp3",
		r2Key: null,
		tags: ["love", "wedding", "soft", "warm"],
		useCases: ["beauty ad", "wedding promo", "couple content"],
		licenseAttribution: null,
	},
	{
		id: "track-007",
		title: "Tension Build Suspense",
		artist: "FB Sound Collection",
		mood: "tense",
		genre: "ambient",
		durationSec: 30,
		bpm: 100,
		source: "FB_SOUND_COLLECTION",
		expectedR2Key: "music/fb-sound-collection/tense-ambient-30s.mp3",
		r2Key: null,
		tags: ["mystery", "anticipation", "thriller"],
		useCases: ["product reveal teaser", "mystery hook"],
		licenseAttribution: null,
	},
	{
		id: "track-008",
		title: "Comedic Quirky",
		artist: "TikTok Creative Center",
		mood: "comedic",
		genre: "pop",
		durationSec: 15,
		bpm: 110,
		source: "TIKTOK_CREATIVE_CENTER",
		expectedR2Key: "music/tiktok-cc/comedic-quirky-15s.mp3",
		r2Key: null,
		tags: ["funny", "playful", "meme", "viral"],
		useCases: ["UGC review", "comedy ad", "meme remix"],
		licenseAttribution: null,
	},
	{
		id: "track-009",
		title: "Hip-Hop Confidence",
		artist: "YouTube Audio Library",
		mood: "upbeat",
		genre: "hip-hop",
		durationSec: 30,
		bpm: 90,
		source: "YOUTUBE_AUDIO_LIB",
		expectedR2Key: "music/yt-audio-lib/hiphop-confidence-30s.mp3",
		r2Key: null,
		tags: ["confident", "strong", "urban"],
		useCases: ["streetwear ad", "fitness reel", "luxury showcase"],
		licenseAttribution: null,
	},
	{
		id: "track-010",
		title: "Ambient Tech Modern",
		artist: "Internal — anh's curation",
		mood: "corporate",
		genre: "ambient",
		durationSec: 60,
		bpm: 85,
		source: "INTERNAL",
		expectedR2Key: "music/internal/ambient-tech-60s.mp3",
		r2Key: null,
		tags: ["tech", "modern", "futuristic", "minimal"],
		useCases: ["tech product ad", "SaaS demo", "AI tool intro"],
		licenseAttribution: "Internal license — PixelxLab",
	},
];
