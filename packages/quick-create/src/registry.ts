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
import { AUDIENCE_CHIPS } from "./data/audiences.js";
import { LOOK_FEEL_CHIPS } from "./data/look-feel.js";
import { PLATFORM_CHIPS } from "./data/platforms.js";

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

export const audienceRegistry = new ChipRegistry<AudienceChip>(AUDIENCE_CHIPS);
export const lookFeelRegistry = new ChipRegistry<LookFeelChip>(LOOK_FEEL_CHIPS);
export const platformRegistry = new ChipRegistry<PlatformChip>(PLATFORM_CHIPS);
