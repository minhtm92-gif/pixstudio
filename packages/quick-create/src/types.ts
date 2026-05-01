/**
 * Quick Create core types — Phase 1 Sprint 1 foundation
 *
 * Reference: SCOPE.md §13 + docs/quick-create/acceptance-criteria-draft.md
 */

import { z } from "zod";

// ─── Workflow templates ────────────────────────────────────────────

export const TierSchema = z.enum(["standard", "pro", "max"]);
export type Tier = z.infer<typeof TierSchema>;

export const PaceSchema = z.enum(["slow", "medium", "fast"]);
export type Pace = z.infer<typeof PaceSchema>;

export const LanguageSchema = z.enum(["vi", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const RatioSchema = z.enum(["9:16", "16:9", "1:1", "4:5", "21:9"]);
export type Ratio = z.infer<typeof RatioSchema>;

export const PlatformPresetSchema = z.object({
	ratio: RatioSchema,
	minDurationSec: z.number().int().positive(),
	maxDurationSec: z.number().int().positive(),
	defaultDurationSec: z.number().int().positive(),
});
export type PlatformPreset = z.infer<typeof PlatformPresetSchema>;

export const VoicePresetSchema = z.object({
	voiceId: z.string(), // ElevenLabs voice ID
	voiceName: z.string(),
	speed: z.number().min(0.5).max(2.0).default(1.0),
	stability: z.number().min(0).max(1).default(0.5),
	similarityBoost: z.number().min(0).max(1).default(0.75),
});
export type VoicePreset = z.infer<typeof VoicePresetSchema>;

export const SubtitleStyleSchema = z.object({
	font: z.enum(["Inter", "Bebas Neue", "Montserrat", "Pacifico", "Noto Sans VN"]),
	fontSize: z.number().int().positive(),
	fontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
	strokeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
	strokeWidth: z.number().int().min(0).max(10),
	animation: z.enum(["fade-in", "scale-pop", "typewriter", "slide-up", "none"]),
	position: z.enum(["bottom", "center", "top"]),
});
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;

export const StockSourceSchema = z.enum([
	"iStock",
	"Envato",
	"Shutterstock",
	"iStock-tet-pool",
	"Envato-tet-pool",
]);
export type StockSource = z.infer<typeof StockSourceSchema>;

export const MusicSourcePolicySchema = z.enum([
	"library-only",
	"library-or-uploaded",
	"auto-generate",
]);
export type MusicSourcePolicy = z.infer<typeof MusicSourcePolicySchema>;

export const SeasonalLockoutSchema = z.object({
	startMonth: z.number().int().min(1).max(12),
	endMonth: z.number().int().min(1).max(12),
});

export const VisualStyleSchema = z.object({
	lut: z.string().optional(), // LUT preset name (e.g. "Teal-Orange")
	letterbox: z.boolean().default(false),
	filmGrain: z.enum(["none", "subtle", "medium", "heavy"]).default("none"),
});

export const MusicLibraryFilterSchema = z.object({
	genre: z.array(z.string()).optional(),
	mood: z.array(z.string()).optional(),
});

export const WorkflowTemplateSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/), // unique slug
	name: z.string(), // display VN
	nameEn: z.string(), // display EN
	description: z.string(),
	thumbnail: z.string().url().or(z.string().startsWith("/")), // R2 URL or local path
	pace: PaceSchema,
	defaultLanguage: LanguageSchema,
	platform: PlatformPresetSchema,
	voice: VoicePresetSchema,
	subtitleStyle: SubtitleStyleSchema,
	watermarkPosition: z.enum([
		"top-left",
		"top-right",
		"bottom-left",
		"bottom-right",
		"none",
	]),
	stockSources: z.array(StockSourceSchema),
	musicSourcePolicy: MusicSourcePolicySchema,
	musicLibraryFilter: MusicLibraryFilterSchema.optional(),
	samplePrompts: z.array(z.string()).min(1).max(10),
	requiredTier: TierSchema,
	seasonalLockout: SeasonalLockoutSchema.optional(),
	visualStyle: VisualStyleSchema.optional(),
	chapterMarkers: z.boolean().optional(),
	introOutro: z.boolean().optional(),
	inputMode: z.enum(["prompt", "script-paste"]).default("prompt"),
	sceneSplitStrategy: z.enum(["sentence", "paragraph", "manual-markers"]).optional(),
	maxScriptLength: z.number().int().positive().optional(),
});
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;

// ─── Chip selectors (View 4 Outline) ───────────────────────────────

export const ChipCategorySchema = z.enum(["audience", "lookFeel", "platform"]);
export type ChipCategory = z.infer<typeof ChipCategorySchema>;

export const AudienceChipSchema = z.object({
	id: z.string(),
	displayVi: z.string(),
	displayEn: z.string(),
	toneHint: z.string(), // private cho LLM, không expose UI
	active: z.boolean().default(true),
});
export type AudienceChip = z.infer<typeof AudienceChipSchema>;

export const LookFeelChipSchema = z.object({
	id: z.string(),
	displayVi: z.string(),
	displayEn: z.string(),
	colorPalette: z.string(),
	transitionStyle: z.string(),
	musicGenre: z.string(),
	active: z.boolean().default(true),
});
export type LookFeelChip = z.infer<typeof LookFeelChipSchema>;

export const PlatformChipSchema = z.object({
	id: z.string(),
	displayVi: z.string(),
	displayEn: z.string(),
	ratio: RatioSchema,
	maxDurationSec: z.number().int().positive(),
	formatExport: z.string(),
	active: z.boolean().default(true),
});
export type PlatformChip = z.infer<typeof PlatformChipSchema>;

// ─── Quick Create session state ────────────────────────────────────

export const QuickCreateSessionSchema = z.object({
	id: z.string().uuid(),
	userId: z.string(),
	workspaceId: z.string().uuid(),

	// View 1: Hero
	prompt: z.string().max(25_000),
	mode: z.enum(["pathA", "pathB"]).default("pathA"),

	// Path B: video reference (instead of prompt)
	pathBSource: z
		.discriminatedUnion("type", [
			z.object({ type: z.literal("upload"), assetId: z.string().uuid() }),
			z.object({ type: z.literal("url"), url: z.string().url() }),
		])
		.optional(),

	// View 2: Workflow picker
	workflowId: z.string().optional(),

	// View 3: Workflow config (overrides defaults from workflow)
	configOverrides: z
		.object({
			pace: PaceSchema.optional(),
			topic: z.string().optional(),
			musicPrompt: z.string().optional(),
			language: LanguageSchema.optional(),
			style: z.string().optional(),
			voice: VoicePresetSchema.partial().optional(),
			subtitleStyle: SubtitleStyleSchema.partial().optional(),
			watermarkText: z.string().max(20).optional(),
			stockSources: z.array(StockSourceSchema).optional(),
			musicSourcePolicy: MusicSourcePolicySchema.optional(),
		})
		.default({}),

	// View 4: Outline review
	outline: z
		.object({
			title: z.string(),
			scenes: z.array(
				z.object({
					id: z.string(),
					order: z.number().int(),
					script: z.string(),
					mediaQuery: z.string().optional(), // stock search query
					durationSec: z.number().positive(),
				})
			),
			suggestedChips: z.object({
				audiences: z.array(z.string()).max(3),
				lookFeel: z.array(z.string()).max(2),
				platform: z.string(),
			}),
		})
		.optional(),

	// User chip selections (override suggestions)
	chipSelections: z
		.object({
			audiences: z.array(z.string()).max(3),
			lookFeel: z.array(z.string()).max(2),
			platform: z.string(),
		})
		.optional(),

	// View 5: Build job tracking
	buildJobId: z.string().optional(),
	buildStatus: z
		.enum([
			"pending",
			"generating-script",
			"synthesizing-voice",
			"matching-stock",
			"composing-scenes",
			"rendering-preview",
			"completed",
			"failed",
			"cancelled",
		])
		.default("pending"),
	buildProgress: z.number().min(0).max(100).default(0),
	buildErrorMessage: z.string().optional(),

	// View 6: Editor handoff
	projectId: z.string().uuid().optional(), // points to /api/projects entry once build completes

	// Metadata
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	completedAt: z.coerce.date().optional(),
});
export type QuickCreateSession = z.infer<typeof QuickCreateSessionSchema>;

// ─── Build pipeline events (WebSocket) ─────────────────────────────

export const BuildEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("status-change"),
		sessionId: z.string(),
		status: QuickCreateSessionSchema.shape.buildStatus,
		progress: z.number().min(0).max(100),
		etaSec: z.number().int().nonnegative().optional(),
	}),
	z.object({
		type: z.literal("scene-rendered"),
		sessionId: z.string(),
		sceneId: z.string(),
		previewUrl: z.string().url(),
	}),
	z.object({
		type: z.literal("error"),
		sessionId: z.string(),
		message: z.string(),
		retryable: z.boolean(),
	}),
	z.object({
		type: z.literal("completed"),
		sessionId: z.string(),
		projectId: z.string().uuid(),
		thumbnailUrl: z.string().url(),
	}),
]);
export type BuildEvent = z.infer<typeof BuildEventSchema>;

// ─── Path B reverse engineer pipeline ──────────────────────────────

export const ReverseEngineerJobSchema = z.object({
	id: z.string().uuid(),
	sessionId: z.string().uuid(), // links back to QuickCreateSession
	source: z.discriminatedUnion("type", [
		z.object({ type: z.literal("upload"), r2Key: z.string() }),
		z.object({ type: z.literal("url"), url: z.string().url() }),
	]),

	// Pipeline stages (per SCOPE.md §13)
	stages: z.object({
		download: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				durationMs: z.number().optional(),
				audioR2Key: z.string().optional(),
			})
			.default({ status: "pending" }),
		sceneDetect: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				scenes: z
					.array(
						z.object({
							startSec: z.number(),
							endSec: z.number(),
						})
					)
					.optional(),
			})
			.default({ status: "pending" }),
		audioStems: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				stems: z
					.object({
						voice: z.string(), // R2 key
						drums: z.string(),
						bass: z.string(),
						other: z.string(),
					})
					.optional(),
			})
			.default({ status: "pending" }),
		transcribe: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				segments: z
					.array(
						z.object({
							speaker: z.string(),
							startSec: z.number(),
							endSec: z.number(),
							text: z.string(),
							words: z
								.array(
									z.object({
										word: z.string(),
										startSec: z.number(),
										endSec: z.number(),
									})
								)
								.optional(),
						})
					)
					.optional(),
			})
			.default({ status: "pending" }),
		musicMatch: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				candidates: z
					.array(
						z.object({
							trackId: z.string(),
							similarity: z.number().min(0).max(1),
							genre: z.string(),
							mood: z.string(),
						})
					)
					.optional(),
			})
			.default({ status: "pending" }),
		visualAnalysis: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				perScene: z
					.array(
						z.object({
							sceneIdx: z.number().int(),
							tone: z.enum(["warm", "cool", "neutral"]),
							colorPalette: z.array(z.string()).max(5),
							style: z.string(),
							dominantObjects: z.array(z.string()).max(5),
							emotion: z.string(),
						})
					)
					.optional(),
			})
			.default({ status: "pending" }),
		buildEditorState: z
			.object({
				status: z.enum(["pending", "running", "done", "failed"]),
				projectId: z.string().uuid().optional(),
			})
			.default({ status: "pending" }),
	}),

	totalCostUsd: z.number().nonnegative().default(0),
	totalDurationMs: z.number().nonnegative().default(0),
	createdAt: z.coerce.date(),
	completedAt: z.coerce.date().optional(),
});
export type ReverseEngineerJob = z.infer<typeof ReverseEngineerJobSchema>;
