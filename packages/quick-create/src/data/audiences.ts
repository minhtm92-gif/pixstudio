/**
 * Audience chips — 25 generic audiences (no country suffix per Q71).
 *
 * Country derives from `language` config (vi → Vietnam market, en → cross-border).
 * Crossian RAG eligibility: not chip-level — workflow-level (tags `dropshipping` /
 * `facebook-ad` + language `en` trigger RAG).
 *
 * Tags: `crossian` = Crossian core demographic (Senior 50+, pain-points, comfort
 * products). `entertainment` = UC3+UC4 audience. `b2b` = ecom seller / saas.
 */

import type { AudienceChip } from "../types.js";

export const AUDIENCE_CHIPS: AudienceChip[] = [
	{
		id: "ecom-buyer",
		displayVi: "Người mua online",
		displayEn: "Ecom buyer",
		toneHint: "Trực tiếp, action-oriented, value-focused, scarcity hooks",
		active: true,
	},
	{
		id: "senior-50plus",
		displayVi: "Người 50+",
		displayEn: "Senior 50+",
		toneHint: "Trầm, rõ ràng, lễ độ, tránh slang, nhấn comfort + sức khỏe",
		active: true,
	},
	{
		id: "office-worker",
		displayVi: "Dân văn phòng",
		displayEn: "Office worker",
		toneHint: "Productivity, work-life balance, tiết kiệm thời gian",
		active: true,
	},
	{
		id: "young-parents",
		displayVi: "Phụ huynh trẻ",
		displayEn: "Young parents",
		toneHint: "An toàn, gia đình, giá trị, time-saving",
		active: true,
	},
	{
		id: "gen-z-tiktok",
		displayVi: "Gen Z TikTok",
		displayEn: "Gen Z TikTok",
		toneHint: "Trendy, viral hooks, slang OK, fast-paced, FOMO",
		active: true,
	},
	{
		id: "gen-z-shorts",
		displayVi: "Gen Z Shorts",
		displayEn: "Gen Z Shorts",
		toneHint: "Hype, energy, meme refs, hook 1s đầu",
		active: true,
	},
	{
		id: "gen-z-youtube",
		displayVi: "Gen Z YouTube",
		displayEn: "Gen Z YouTube",
		toneHint: "Storytelling, narrative arc, deeper than Shorts",
		active: true,
	},
	{
		id: "mom-baby",
		displayVi: "Mẹ bỉm sữa",
		displayEn: "Mom-baby",
		toneHint: "An toàn cho bé, tiện lợi, gentle, tin tưởng",
		active: true,
	},
	{
		id: "fitness-enthusiast",
		displayVi: "Người tập gym",
		displayEn: "Fitness enthusiast",
		toneHint: "Performance, results-focused, before/after, science-backed",
		active: true,
	},
	{
		id: "beauty-shopper",
		displayVi: "Người mua mỹ phẩm",
		displayEn: "Beauty shopper",
		toneHint: "Aesthetic, trải nghiệm da, before/after, reviews",
		active: true,
	},
	{
		id: "food-lover",
		displayVi: "Tín đồ ẩm thực",
		displayEn: "Food lover",
		toneHint: "Sensory, ngon mắt, recipe-friendly, ASMR cooking",
		active: true,
	},
	{
		id: "pet-owner",
		displayVi: "Sen chó/mèo",
		displayEn: "Pet owner",
		toneHint: "Cute, bond, safety for pets, heart-warming",
		active: true,
	},
	{
		id: "tech-adopter",
		displayVi: "Tech early-adopter",
		displayEn: "Tech early adopter",
		toneHint: "Specs, innovation, productivity gains, comparison",
		active: true,
	},
	{
		id: "gift-giver",
		displayVi: "Mua quà tặng",
		displayEn: "Gift-giver",
		toneHint: "Emotional, surprise, occasion-driven, perfect-gift framing",
		active: true,
	},
	{
		id: "pain-back",
		displayVi: "Đau lưng / cổ vai gáy",
		displayEn: "Back / neck pain",
		toneHint: "Pain validation, relief promise, posture science, doctor-approved hint",
		active: true,
	},
	{
		id: "pain-skin",
		displayVi: "Vấn đề da",
		displayEn: "Skin issue",
		toneHint: "Empathy, skin journey, natural ingredients, gentle results",
		active: true,
	},
	{
		id: "pain-weight",
		displayVi: "Giảm cân",
		displayEn: "Weight loss",
		toneHint: "Realistic, sustainable, before/after, no shame, body positive",
		active: true,
	},
	{
		id: "entertainment-seeker",
		displayVi: "Tìm giải trí",
		displayEn: "Entertainment seeker",
		toneHint: "Engaging, surprising, fun, no hard sell",
		active: true,
	},
	{
		id: "family",
		displayVi: "Gia đình",
		displayEn: "Family",
		toneHint: "Warm, inclusive, multi-generational, values",
		active: true,
	},
	{
		id: "student",
		displayVi: "Sinh viên",
		displayEn: "Student",
		toneHint: "Affordable, study tips, dorm life, peer-relatable",
		active: true,
	},
	{
		id: "ecom-seller",
		displayVi: "Chủ shop online",
		displayEn: "Ecom seller",
		toneHint: "B2B, ROI, scale, automation, time-saving",
		active: true,
	},
	{
		id: "live-stream-host",
		displayVi: "Streamer / live host",
		displayEn: "Live stream host",
		toneHint: "Energy, audience engagement, conversion-focused, real-time",
		active: true,
	},
	{
		id: "gamer",
		displayVi: "Game thủ",
		displayEn: "Gamer",
		toneHint: "Performance, competitive, FPS gains, RGB aesthetic",
		active: true,
	},
	{
		id: "travel",
		displayVi: "Tín đồ du lịch",
		displayEn: "Travel enthusiast",
		toneHint: "Wanderlust, scenery, destinations, packable, instagrammable",
		active: true,
	},
	{
		id: "self-improve",
		displayVi: "Phát triển bản thân",
		displayEn: "Self-improvement",
		toneHint: "Growth, habit, motivation, daily wins, before/after self",
		active: true,
	},
];
