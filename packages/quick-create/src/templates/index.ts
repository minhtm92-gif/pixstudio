/**
 * Workflow templates auto-load registry.
 *
 * 9 templates v1 (8 chốt + 1 dropshipping-fb-ad cross-border for UC2):
 * - ad-product-vn        — VN generic ad (no Crossian RAG)
 * - dropshipping-fb-ad   — UC2 EN cross-border (FIRES Crossian RAG)
 * - ugc-review-tiktok    — UC1 VN UGC review
 * - demo-product         — B2B demo
 * - youtube-long-entertainment — UC3 long entertainment
 * - short-entertainment  — UC4 viral shorts
 * - storytelling-cinematic — narrative
 * - tet-bundle           — seasonal T11-T2
 * - script-to-video      — utility paste-script
 */

import type { WorkflowTemplate } from "../types.js";

import adProductVn from "./ad-product-vn.js";
import dropshippingFbAd from "./dropshipping-fb-ad.js";
import ugcReviewTiktok from "./ugc-review-tiktok.js";
import demoProduct from "./demo-product.js";
import youtubeLongEntertainment from "./youtube-long-entertainment.js";
import shortEntertainment from "./short-entertainment.js";
import storytellingCinematic from "./storytelling-cinematic.js";
import tetBundle from "./tet-bundle.js";
import scriptToVideo from "./script-to-video.js";

export const ALL_TEMPLATES: WorkflowTemplate[] = [
	adProductVn,
	dropshippingFbAd,
	ugcReviewTiktok,
	demoProduct,
	youtubeLongEntertainment,
	shortEntertainment,
	storytellingCinematic,
	tetBundle,
	scriptToVideo,
];
