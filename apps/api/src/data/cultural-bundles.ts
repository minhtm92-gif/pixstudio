/**
 * Cultural VN bundles — Sprint S32 (T-3 SCOPE §4.5).
 *
 * Tết / Trung Thu / Quốc Khánh / Black Friday seasonal asset bundles.
 * Each bundle contains: stock footage tags, music mood, color palette,
 * caption preset, font pack — pre-curated for 4 major VN cultural moments.
 *
 * Used by Quick Create workflow picker as "Seasonal" filter + Asset Studio
 * cultural shortcut tab.
 */

export interface CulturalBundle {
	id: string;
	holiday: "tet" | "trungthu" | "quockhanh" | "blackfriday";
	labelVi: string;
	labelEn: string;
	/** Active visibility window (month range, inclusive). */
	monthsActive: number[];
	colorPalette: string[];
	musicMood: "epic" | "upbeat" | "romantic" | "cinematic";
	captionPresetId: string;
	suggestedTemplateIds: string[];
	stockSearchTags: string[];
	emojiBadge: string;
}

export const CULTURAL_BUNDLES: CulturalBundle[] = [
	{
		id: "tet-2027",
		holiday: "tet",
		labelVi: "Tết Đinh Tỵ 2027",
		labelEn: "Lunar New Year 2027",
		monthsActive: [12, 1, 2], // Dec-Feb
		colorPalette: ["#FCD34D", "#DC2626", "#7F1D1D", "#0F172A"],
		musicMood: "upbeat",
		captionPresetId: "tet-festive",
		suggestedTemplateIds: ["tpl-tet-greeting", "tpl-tet-bundle-promo"],
		stockSearchTags: ["lunar new year", "vietnamese tet", "red envelope", "kumquat tree", "ao dai"],
		emojiBadge: "🧨",
	},
	{
		id: "trungthu-2026",
		holiday: "trungthu",
		labelVi: "Trung Thu 2026",
		labelEn: "Mid-Autumn Festival 2026",
		monthsActive: [8, 9],
		colorPalette: ["#F59E0B", "#92400E", "#1F2937"],
		musicMood: "romantic",
		captionPresetId: "cinematic-letterbox",
		suggestedTemplateIds: ["tpl-trungthu-mooncake"],
		stockSearchTags: ["mooncake", "lantern", "mid autumn", "mid-autumn", "moon"],
		emojiBadge: "🥮",
	},
	{
		id: "quockhanh-2026",
		holiday: "quockhanh",
		labelVi: "Quốc Khánh 2/9",
		labelEn: "National Day Sept 2",
		monthsActive: [8, 9],
		colorPalette: ["#DC2626", "#FCD34D", "#FFFFFF"],
		musicMood: "epic",
		captionPresetId: "news-corporate",
		suggestedTemplateIds: ["tpl-quockhanh-promo"],
		stockSearchTags: ["vietnam flag", "ho chi minh", "national day vietnam"],
		emojiBadge: "🇻🇳",
	},
	{
		id: "blackfriday-2026",
		holiday: "blackfriday",
		labelVi: "Black Friday 2026",
		labelEn: "Black Friday 2026",
		monthsActive: [11],
		colorPalette: ["#000000", "#DC2626", "#FCD34D"],
		musicMood: "epic",
		captionPresetId: "tiktok-bold",
		suggestedTemplateIds: ["tpl-blackfriday-flash"],
		stockSearchTags: ["black friday", "sale", "discount", "shopping cart"],
		emojiBadge: "🛍️",
	},
];

export function findCulturalBundle(id: string): CulturalBundle | undefined {
	return CULTURAL_BUNDLES.find((b) => b.id === id);
}

export function getActiveBundlesForMonth(month1Indexed: number): CulturalBundle[] {
	return CULTURAL_BUNDLES.filter((b) => b.monthsActive.includes(month1Indexed));
}
