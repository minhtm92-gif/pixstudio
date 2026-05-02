/**
 * Look & Feel chips — 12 visual styles (Q7 chốt).
 *
 * Each chip drives:
 * - colorPalette → CSS LUT preset (later wired into compositor Sprint 4)
 * - transitionStyle → BullMQ "compose" stage transition rules
 * - musicGenre → music library filter (FB Sound Collection / TikTok CC)
 */

import type { LookFeelChip } from "../types.js";

export const LOOK_FEEL_CHIPS: LookFeelChip[] = [
	{
		id: "ugc-authentic",
		displayVi: "UGC tự nhiên",
		displayEn: "UGC authentic",
		colorPalette: "Warm-natural",
		transitionStyle: "Hard cuts, no transitions",
		musicGenre: "Lo-fi, indie, vlog beats",
		active: true,
	},
	{
		id: "ad-style",
		displayVi: "Quảng cáo",
		displayEn: "Ad style",
		colorPalette: "Vibrant high-contrast",
		transitionStyle: "Quick cuts, zoom-in product",
		musicGenre: "Upbeat pop, energetic",
		active: true,
	},
	{
		id: "cinematic",
		displayVi: "Điện ảnh",
		displayEn: "Cinematic",
		colorPalette: "Teal-Orange",
		transitionStyle: "Smooth fade, letterbox",
		musicGenre: "Orchestral, cinematic build",
		active: true,
	},
	{
		id: "vlog",
		displayVi: "Vlog cá nhân",
		displayEn: "Vlog daily",
		colorPalette: "Natural daylight",
		transitionStyle: "J-cut + zoom whip",
		musicGenre: "Lo-fi, indie acoustic",
		active: true,
	},
	{
		id: "comedy",
		displayVi: "Hài giải trí",
		displayEn: "Comedy",
		colorPalette: "Bright saturated",
		transitionStyle: "Snap zoom, freeze frame",
		musicGenre: "Quirky, plucky strings",
		active: true,
	},
	{
		id: "dramatic",
		displayVi: "Kịch tính",
		displayEn: "Dramatic",
		colorPalette: "High-contrast, dark shadows",
		transitionStyle: "Slow push-in, zoom-out reveal",
		musicGenre: "Dramatic strings, tension build",
		active: true,
	},
	{
		id: "kawaii",
		displayVi: "Dễ thương",
		displayEn: "Kawaii",
		colorPalette: "Pastel pink-peach",
		transitionStyle: "Sticker pop, soft fade",
		musicGenre: "J-pop, cute synth",
		active: true,
	},
	{
		id: "food-porn",
		displayVi: "Ẩm thực ngon",
		displayEn: "Food porn",
		colorPalette: "Warm saturated, golden",
		transitionStyle: "Slow-mo pour, close-up steam",
		musicGenre: "Jazzy lounge, soft groove",
		active: true,
	},
	{
		id: "lifestyle",
		displayVi: "Đời sống",
		displayEn: "Lifestyle",
		colorPalette: "Bright airy, natural",
		transitionStyle: "Soft fade, parallax",
		musicGenre: "Indie folk, dreamy",
		active: true,
	},
	{
		id: "tech-modern",
		displayVi: "Công nghệ",
		displayEn: "Tech modern",
		colorPalette: "Cool blue-cyan, neon accent",
		transitionStyle: "Glitch, motion graphics",
		musicGenre: "Electronic, synthwave",
		active: true,
	},
	{
		id: "minimal",
		displayVi: "Tối giản",
		displayEn: "Minimal",
		colorPalette: "Monochrome, beige-cream",
		transitionStyle: "Cut, no fancy transitions",
		musicGenre: "Ambient, soft piano",
		active: true,
	},
	{
		id: "retro-80s",
		displayVi: "Retro 80s",
		displayEn: "Retro 80s",
		colorPalette: "Synthwave purple-pink",
		transitionStyle: "VHS scan-line, glow",
		musicGenre: "Synthwave, 80s pop",
		active: true,
	},
];
