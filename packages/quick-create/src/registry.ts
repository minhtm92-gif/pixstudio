/**
 * Workflow + chip registry — plugin-style.
 *
 * Templates auto-loaded from `./templates/*.ts`. Each template default-exports
 * a WorkflowTemplate. Add new workflow = drop new file into `./templates/`,
 * no other registration needed.
 *
 * Phase 1 Sprint 1 wiring after anh fills `docs/quick-create/workflow-templates-form.md`.
 */

import type { AudienceChip, LookFeelChip, PlatformChip, WorkflowTemplate } from "./types.js";
import { ALL_TEMPLATES } from "./templates/index.js";

// ─── Workflow registry ─────────────────────────────────────────────

class WorkflowRegistry {
	private templates = new Map<string, WorkflowTemplate>();

	constructor(initialTemplates: WorkflowTemplate[] = []) {
		for (const t of initialTemplates) this.templates.set(t.id, t);
	}

	register(template: WorkflowTemplate): void {
		if (this.templates.has(template.id)) {
			throw new Error(`Workflow ${template.id} already registered`);
		}
		this.templates.set(template.id, template);
	}

	get(id: string): WorkflowTemplate | undefined {
		return this.templates.get(id);
	}

	listAll(): WorkflowTemplate[] {
		return Array.from(this.templates.values());
	}

	listByTier(tier: "standard" | "pro" | "max"): WorkflowTemplate[] {
		const tierRank = { standard: 0, pro: 1, max: 2 };
		return this.listAll().filter((t) => tierRank[t.requiredTier] <= tierRank[tier]);
	}

	listAvailableNow(now: Date = new Date()): WorkflowTemplate[] {
		const month = now.getMonth() + 1; // 1-12
		return this.listAll().filter((t) => {
			if (!t.seasonalLockout) return true;
			const { startMonth, endMonth } = t.seasonalLockout;
			if (startMonth <= endMonth) {
				return month >= startMonth && month <= endMonth;
			}
			// wrap around year (e.g. Dec-Feb)
			return month >= startMonth || month <= endMonth;
		});
	}
}

export const workflowRegistry = new WorkflowRegistry(ALL_TEMPLATES);

// ─── Chip registry ─────────────────────────────────────────────────

// PLACEHOLDER: stubs to be replaced when anh fills chip-content-form.md.

const PLACEHOLDER_AUDIENCES: AudienceChip[] = [
	{
		id: "senior-50plus-vn",
		displayVi: "Senior 50+ VN",
		displayEn: "Senior 50+ Vietnam",
		toneHint: "Trầm, rõ ràng, tránh slang",
		active: true,
	},
	{
		id: "genz-tiktok",
		displayVi: "Gen Z TikTok",
		displayEn: "Gen Z TikTok",
		toneHint: "Trendy, viral hooks, slang OK",
		active: true,
	},
];

const PLACEHOLDER_LOOK_FEEL: LookFeelChip[] = [
	{
		id: "cinematic",
		displayVi: "Cinematic",
		displayEn: "Cinematic",
		colorPalette: "Teal-Orange",
		transitionStyle: "Smooth fade",
		musicGenre: "Orchestral / Cinematic",
		active: true,
	},
	{
		id: "vlog",
		displayVi: "Vlog daily",
		displayEn: "Vlog daily",
		colorPalette: "Natural",
		transitionStyle: "Cuts + zoom",
		musicGenre: "Lo-fi / Indie",
		active: true,
	},
];

const PLACEHOLDER_PLATFORMS: PlatformChip[] = [
	{
		id: "tiktok",
		displayVi: "TikTok",
		displayEn: "TikTok",
		ratio: "9:16",
		maxDurationSec: 60,
		formatExport: "mp4 H.264",
		active: true,
	},
	{
		id: "youtube-shorts",
		displayVi: "YouTube Shorts",
		displayEn: "YouTube Shorts",
		ratio: "9:16",
		maxDurationSec: 60,
		formatExport: "mp4 H.264",
		active: true,
	},
	{
		id: "youtube-long",
		displayVi: "YouTube long",
		displayEn: "YouTube long-form",
		ratio: "16:9",
		maxDurationSec: 900,
		formatExport: "mp4 H.264",
		active: true,
	},
];

class ChipRegistry<T extends { id: string; active: boolean }> {
	private chips = new Map<string, T>();

	constructor(initial: T[] = []) {
		for (const c of initial) this.chips.set(c.id, c);
	}

	register(chip: T): void {
		if (this.chips.has(chip.id)) throw new Error(`Chip ${chip.id} already registered`);
		this.chips.set(chip.id, chip);
	}

	get(id: string): T | undefined {
		return this.chips.get(id);
	}

	listActive(): T[] {
		return Array.from(this.chips.values()).filter((c) => c.active);
	}
}

export const audienceRegistry = new ChipRegistry<AudienceChip>(PLACEHOLDER_AUDIENCES);
export const lookFeelRegistry = new ChipRegistry<LookFeelChip>(PLACEHOLDER_LOOK_FEEL);
export const platformRegistry = new ChipRegistry<PlatformChip>(PLACEHOLDER_PLATFORMS);
