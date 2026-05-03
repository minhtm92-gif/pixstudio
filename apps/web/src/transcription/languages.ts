// SCOPE D23: VN/EN only for Phase 1-4. ZH/JA/ES/IT/FR/DE/PT/RU dropped from
// transcription UI dropdown (OpenCut inherited list). Re-add per-language after
// product expansion to SEA (Phase 5+, Khmer/Thai/Indonesian).
export const LANGUAGES = [
	{ code: "vi", name: "Vietnamese" },
	{ code: "en", name: "English" },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language["code"];
