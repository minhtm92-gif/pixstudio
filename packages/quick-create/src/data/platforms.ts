/**
 * Platform chips — 7 platforms (Q9 chốt + add fb-ad-vertical 4:5 cho UC2 dropshipping).
 */

import type { PlatformChip } from "../types.js";

export const PLATFORM_CHIPS: PlatformChip[] = [
	{
		id: "tiktok",
		displayVi: "TikTok",
		displayEn: "TikTok",
		ratio: "9:16",
		maxDurationSec: 600, // TikTok 10min cap
		formatExport: "mp4 H.264 1080×1920",
		active: true,
	},
	{
		id: "youtube-shorts",
		displayVi: "YouTube Shorts",
		displayEn: "YouTube Shorts",
		ratio: "9:16",
		maxDurationSec: 60,
		formatExport: "mp4 H.264 1080×1920",
		active: true,
	},
	{
		id: "ig-reels",
		displayVi: "IG Reels",
		displayEn: "IG Reels",
		ratio: "9:16",
		maxDurationSec: 90,
		formatExport: "mp4 H.264 1080×1920",
		active: true,
	},
	{
		id: "fb-ad-vertical",
		displayVi: "FB Ad dọc",
		displayEn: "FB Ad vertical",
		ratio: "4:5",
		maxDurationSec: 240, // FB max 4min
		formatExport: "mp4 H.264 1080×1350",
		active: true,
	},
	{
		id: "fb-feed",
		displayVi: "FB Feed",
		displayEn: "FB Feed square",
		ratio: "1:1",
		maxDurationSec: 240,
		formatExport: "mp4 H.264 1080×1080",
		active: true,
	},
	{
		id: "youtube-long",
		displayVi: "YouTube long",
		displayEn: "YouTube long-form",
		ratio: "16:9",
		maxDurationSec: 900, // 15min cap v1
		formatExport: "mp4 H.264 1920×1080",
		active: true,
	},
	{
		id: "linkedin",
		displayVi: "LinkedIn",
		displayEn: "LinkedIn",
		ratio: "16:9",
		maxDurationSec: 600,
		formatExport: "mp4 H.264 1920×1080",
		active: true,
	},
];
