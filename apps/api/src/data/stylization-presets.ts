/**
 * Stylization presets — Sprint S30 (PW-27).
 *
 * 8 ComfyUI AnimateDiff presets per SCOPE PW-27. Each preset = a named
 * ComfyUI workflow JSON identified by promptKeyword + LoRA + style ref.
 * v1 metadata only — actual ComfyUI invoke (S31+) when GPU droplet ready.
 */

export interface StylizationPreset {
	id: string;
	labelVi: string;
	labelEn: string;
	thumbnailUrl: string;
	promptKeyword: string;
	/** ComfyUI workflow JSON file name in pre-installed snapshot. */
	workflowFile: string;
	/** Approx render cost per second of input video. */
	costPerSecUsd: number;
	/** Tier required. */
	requiredTier: "pro" | "max";
}

export const STYLIZATION_PRESETS: StylizationPreset[] = [
	{
		id: "anime-ghibli",
		labelVi: "Anime Ghibli",
		labelEn: "Anime Ghibli",
		thumbnailUrl: "https://stub/anime-ghibli.jpg",
		promptKeyword: "Studio Ghibli style, hand-drawn animation, soft pastel colors",
		workflowFile: "anime-ghibli-v1.json",
		costPerSecUsd: 0.08,
		requiredTier: "pro",
	},
	{
		id: "oil-painting",
		labelVi: "Tranh sơn dầu",
		labelEn: "Oil painting",
		thumbnailUrl: "https://stub/oil-painting.jpg",
		promptKeyword: "Classical oil painting, brush strokes, Renaissance style",
		workflowFile: "oil-painting-v1.json",
		costPerSecUsd: 0.07,
		requiredTier: "pro",
	},
	{
		id: "cyberpunk",
		labelVi: "Cyberpunk neon",
		labelEn: "Cyberpunk neon",
		thumbnailUrl: "https://stub/cyberpunk.jpg",
		promptKeyword: "Cyberpunk 2077 aesthetic, neon lights, rain, futuristic",
		workflowFile: "cyberpunk-neon-v1.json",
		costPerSecUsd: 0.09,
		requiredTier: "pro",
	},
	{
		id: "comic-book",
		labelVi: "Comic book",
		labelEn: "Comic book",
		thumbnailUrl: "https://stub/comic.jpg",
		promptKeyword: "Comic book style, halftone dots, bold ink outlines",
		workflowFile: "comic-book-v1.json",
		costPerSecUsd: 0.06,
		requiredTier: "pro",
	},
	{
		id: "watercolor",
		labelVi: "Màu nước",
		labelEn: "Watercolor",
		thumbnailUrl: "https://stub/watercolor.jpg",
		promptKeyword: "Watercolor painting, soft edges, paper texture",
		workflowFile: "watercolor-v1.json",
		costPerSecUsd: 0.06,
		requiredTier: "pro",
	},
	{
		id: "pixel-art",
		labelVi: "Pixel art",
		labelEn: "Pixel art",
		thumbnailUrl: "https://stub/pixel.jpg",
		promptKeyword: "Pixel art 16-bit, retro game aesthetic, dithered colors",
		workflowFile: "pixel-art-v1.json",
		costPerSecUsd: 0.05,
		requiredTier: "pro",
	},
	{
		id: "claymation",
		labelVi: "Stop-motion clay",
		labelEn: "Claymation",
		thumbnailUrl: "https://stub/claymation.jpg",
		promptKeyword: "Stop-motion claymation, plasticine texture, Aardman style",
		workflowFile: "claymation-v1.json",
		costPerSecUsd: 0.10,
		requiredTier: "max",
	},
	{
		id: "noir-bw",
		labelVi: "Noir đen trắng",
		labelEn: "Film noir B&W",
		thumbnailUrl: "https://stub/noir.jpg",
		promptKeyword: "Film noir black and white, high contrast, dramatic shadows",
		workflowFile: "noir-bw-v1.json",
		costPerSecUsd: 0.06,
		requiredTier: "pro",
	},
];

export function findStylizationPreset(id: string): StylizationPreset | undefined {
	return STYLIZATION_PRESETS.find((p) => p.id === id);
}
