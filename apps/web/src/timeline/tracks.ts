import type { GenerativeTrackKind, TrackType } from "@/timeline";

export const DEFAULT_TRACK_NAMES: Record<TrackType, string> = {
	video: "Video track",
	text: "Text track",
	audio: "Audio track",
	graphic: "Graphic track",
	effect: "Effect track",
} as const;

/**
 * SCOPE §3.1 + CLAUDE.md §12 — Phase 1 surfaces generative tracks via
 * provenance metadata + display labels. Phase 2 promotes them to first-class
 * TrackType union members.
 */
export const GENERATIVE_TRACK_LABELS: Record<GenerativeTrackKind, string> = {
	imageToVideo: "Image-to-video (Seedance 2.0)",
	textToVideo: "Text-to-video (Veo 3 / Seedance 2.0)",
	aiVoiceover: "AI voiceover (ElevenLabs)",
	aiCharacter: "AI character (Seedream / DreamActor)",
} as const;
