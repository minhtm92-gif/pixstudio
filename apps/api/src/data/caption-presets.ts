/**
 * Caption styling presets — Sprint S17 (PW-15).
 *
 * 8 VN-tuned subtitle style presets per SCOPE §4.1 PW-15.
 * Map to OpenCut subtitle track segment.style fields + ASS-style FFmpeg subtitle
 * filter `force_style` parameter (used by build pipeline Stage 5 + Path B
 * editor state subtitle segments).
 *
 * Naming convention: lowercase id, VN/EN dual labels.
 */

export interface CaptionPreset {
	id: string;
	labelVi: string;
	labelEn: string;
	/** Editor segment style (timeline subtitle segments). */
	editor: {
		font: string;
		size: number;
		color: string;
		strokeColor: string;
		strokeWidth: number;
		bgColor?: string;
		bgOpacity?: number;
		positionY?: "top" | "center" | "bottom";
		marginV?: number;
	};
	/** FFmpeg subtitles filter force_style equivalent (Stage 5 render). */
	ffmpegForceStyle: string;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
	{
		id: "tiktok-bold",
		labelVi: "TikTok đậm",
		labelEn: "TikTok Bold",
		editor: {
			font: "Bebas Neue",
			size: 64,
			color: "#FFFFFF",
			strokeColor: "#000000",
			strokeWidth: 4,
			positionY: "bottom",
			marginV: 80,
		},
		ffmpegForceStyle: "Fontname=Bebas Neue,FontSize=24,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=4,Bold=1,Alignment=2,MarginV=80",
	},
	{
		id: "minimal-clean",
		labelVi: "Tối giản sạch",
		labelEn: "Minimal Clean",
		editor: {
			font: "Inter",
			size: 36,
			color: "#FFFFFF",
			strokeColor: "#000000",
			strokeWidth: 1,
			positionY: "bottom",
			marginV: 60,
		},
		ffmpegForceStyle: "Fontname=Inter,FontSize=18,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=1,Alignment=2,MarginV=60",
	},
	{
		id: "karaoke-pop",
		labelVi: "Karaoke pop",
		labelEn: "Karaoke Pop",
		editor: {
			font: "Pacifico",
			size: 56,
			color: "#FCD34D",
			strokeColor: "#1F2937",
			strokeWidth: 3,
			positionY: "center",
			marginV: 200,
		},
		ffmpegForceStyle: "Fontname=Pacifico,FontSize=22,PrimaryColour=&H4dd3fc&,OutlineColour=&H38291f&,Outline=3,Alignment=2,MarginV=200",
	},
	{
		id: "cinematic-letterbox",
		labelVi: "Cinematic letterbox",
		labelEn: "Cinematic Letterbox",
		editor: {
			font: "Montserrat",
			size: 32,
			color: "#FFFFFF",
			strokeColor: "#000000",
			strokeWidth: 0,
			bgColor: "#000000",
			bgOpacity: 0.7,
			positionY: "bottom",
			marginV: 120,
		},
		ffmpegForceStyle: "Fontname=Montserrat,FontSize=16,PrimaryColour=&Hffffff&,BorderStyle=4,BackColour=&Hb2000000&,Alignment=2,MarginV=120",
	},
	{
		id: "ugc-handwritten",
		labelVi: "UGC viết tay",
		labelEn: "UGC Handwritten",
		editor: {
			font: "Caveat",
			size: 48,
			color: "#FFFFFF",
			strokeColor: "#3B82F6",
			strokeWidth: 2,
			positionY: "center",
			marginV: 300,
		},
		ffmpegForceStyle: "Fontname=Caveat,FontSize=20,PrimaryColour=&Hffffff&,OutlineColour=&Hf6823b&,Outline=2,Alignment=2,MarginV=300",
	},
	{
		id: "news-corporate",
		labelVi: "Tin tức / Corporate",
		labelEn: "News / Corporate",
		editor: {
			font: "Inter",
			size: 28,
			color: "#FFFFFF",
			strokeColor: "#1F2937",
			strokeWidth: 0,
			bgColor: "#1E40AF",
			bgOpacity: 0.95,
			positionY: "bottom",
			marginV: 40,
		},
		ffmpegForceStyle: "Fontname=Inter,FontSize=14,PrimaryColour=&Hffffff&,BorderStyle=4,BackColour=&Hf2401e&,Alignment=2,MarginV=40",
	},
	{
		id: "tet-festive",
		labelVi: "Tết festive",
		labelEn: "Tết Festive",
		editor: {
			font: "Bebas Neue",
			size: 60,
			color: "#FCD34D",
			strokeColor: "#7F1D1D",
			strokeWidth: 4,
			positionY: "bottom",
			marginV: 100,
		},
		ffmpegForceStyle: "Fontname=Bebas Neue,FontSize=22,PrimaryColour=&H4dd3fc&,OutlineColour=&H1d1d7f&,Outline=4,Bold=1,Alignment=2,MarginV=100",
	},
	{
		id: "noto-vn",
		labelVi: "Noto Sans VN (mặc định)",
		labelEn: "Noto Sans VN (default)",
		editor: {
			font: "Noto Sans VN",
			size: 40,
			color: "#FFFFFF",
			strokeColor: "#000000",
			strokeWidth: 2,
			positionY: "bottom",
			marginV: 70,
		},
		ffmpegForceStyle: "Fontname=Noto Sans,FontSize=18,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=70",
	},
];

export function findCaptionPreset(id: string): CaptionPreset | undefined {
	return CAPTION_PRESETS.find((p) => p.id === id);
}
