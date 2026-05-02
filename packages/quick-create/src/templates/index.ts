/**
 * Workflow templates auto-load — drop new file in this folder + import here.
 * Phase 1 Sprint 1: 1 sample (ad-product-vn). Anh fill 7 more from form.
 */

import adProductVn from "./ad-product-vn.js";
import type { WorkflowTemplate } from "../types.js";

export const ALL_TEMPLATES: WorkflowTemplate[] = [
	adProductVn,
	// TODO Sprint 1: anh fills these from docs/quick-create/workflow-templates-form.md
	// ugcSeniorVn,
	// demoProduct,
	// reelHook3s,
	// youtubeLong,
	// storytellingCinematic,
	// tetBundleVn,
	// scriptToVideo,
];
