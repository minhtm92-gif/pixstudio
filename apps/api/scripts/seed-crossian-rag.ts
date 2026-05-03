/**
 * Seed Crossian RAG with 10 sanitized sample dropshipping/facebook-ad documents.
 *
 * These samples are hand-crafted patterns derived from Crossian methodology
 * (5-act structure, hook variants, text overlay templates). Already sanitized
 * — no specific brand names, COGS, or platform handles. Safe to commit + ship.
 *
 * Run via:
 *   bun run apps/api/scripts/seed-crossian-rag.ts
 *
 * Idempotent: skips docs already in DB by source path.
 */

import { PrismaClient } from "@prisma/client";
import { ingestCrossianDocs } from "../src/services/crossian-rag-ingest.js";

const SAMPLES = [
	{
		source: "crossian/seed/01_5act_structure.md",
		contentType: "scene-pattern" as const,
		rawContent: `5-act dropshipping ad structure (proven on FB ad library, ROAS 3-5x):
- Act 1 Hook (0-3s): Pattern interrupt with bold visual + text overlay
- Act 2 Problem (3-7s): Surface pain point, audience nods in agreement
- Act 3 Solution (7-15s): Product reveal as the answer, demo close-up
- Act 4 Social Proof (15-25s): Customer testimonial OR usage at scale
- Act 5 CTA (25-30s): Urgent call to action, link in bio, limited offer
Each scene 2-7s for 9:16 mobile feed. Use jump cuts every 1.5s in act 1
to combat scroll behavior. Avoid white space + slow zooms.`,
	},
	{
		source: "crossian/seed/02_hook_variants.md",
		contentType: "hook-template" as const,
		rawContent: `Hook variants for FB ads dropshipping (first 3s = make-or-break):
1. Emotional: 'I cried when I saw what this did to my [problem]'
2. Identity: 'If you're a [persona] over [age], you NEED to see this'
3. Gift framing: 'My [relation] gave me this and changed my [routine]'
4. Problem-solution: 'Tired of [pain]? Watch this 30 second hack'
5. Number/list: '3 things that fixed my [problem] in 7 days'
6. Question: 'Why are 100,000+ [persona] obsessed with [category]?'
7. Bold claim: 'This [product type] saved me [time/money]'
8. Curiosity gap: 'I tested 5 [products] — only 1 actually worked'
Hooks 1-3 perform best for impulse-purchase categories (beauty, fashion).
Hooks 5-8 better for considered purchase (home, wellness, tech).`,
	},
	{
		source: "crossian/seed/03_text_overlay_templates.md",
		contentType: "text-overlay" as const,
		rawContent: `Text overlay templates that convert (use Bebas Neue or Anton font, white
on black stroke, scale-pop animation):
- '4-Way Stretch' (apparel)
- 'No More [pain]' (problem-aware)
- '50% OFF Today Only' (urgency)
- 'Join 100,000+ Happy Customers' (social proof — round to k or M)
- 'As Seen On [generic-publication]' (authority)
- 'Patented Design' (credibility for tech/wellness)
- 'Doctor Recommended' (medical-adjacent only — must be substantiable)
- 'Made in USA' or 'Made in Vietnam' (origin trust)
- 'Free Shipping Over $50' (CTA-adjacent)
- 'Risk-Free 30-Day Returns' (objection handling)
Avoid: 'Best in class', 'World's #1' (FB ad policy), specific competitor names.`,
	},
	{
		source: "crossian/seed/04_ad_script_apparel_30s.md",
		contentType: "ad-script" as const,
		rawContent: `30-second apparel ad script (FB feed 4:5):
Scene 1 (0-3s): Close-up of someone struggling to button tight pants. Text: '4-Way Stretch finally exists'
Scene 2 (3-7s): Same person in [brand] pants doing yoga, deep squat — pants stretch easily. Voiceover: 'Move freely all day, no more pinching'
Scene 3 (7-12s): Side-by-side: regular jeans tear at squat vs [brand] stretch + recover. Text: 'Tested 1000+ wears'
Scene 4 (12-18s): Customer testimonial cut: 'I wear these to work, gym, dinner — they fit everything'. Show usage montage.
Scene 5 (18-25s): Product flat lay with size range overlay: XS-3XL. Text: 'Inclusive sizing'
Scene 6 (25-30s): 'Get yours' CTA with discount badge '50% OFF + Free Shipping'. Link in bio. End frame holds 1.5s.`,
	},
	{
		source: "crossian/seed/05_ad_script_beauty_15s.md",
		contentType: "ad-script" as const,
		rawContent: `15-second beauty serum ad script (TikTok 9:16, fast-cut for scroll):
Scene 1 (0-2s): Close-up acne or dull skin. Text overlay: 'I tried EVERYTHING for my [skin issue]'
Scene 2 (2-5s): Open serum bottle, 1-2 drops on fingertip, apply. Voice: 'Then I found this'
Scene 3 (5-9s): 7-day before/after carousel (consistent lighting!). Text: 'Day 1 → Day 7' progress bar
Scene 4 (9-12s): Product shot rotating, ingredients overlay (vitamin C 20%, niacinamide 5%). Text: 'Clinically tested'
Scene 5 (12-15s): 'Link in bio' + discount '30% OFF Today'. End frame fades to logo.
Note: before/after MUST be same person same lighting — FB rejects mismatched.`,
	},
	{
		source: "crossian/seed/06_ad_script_home_60s.md",
		contentType: "ad-script" as const,
		rawContent: `60-second home gadget ad script (FB feed + IG reels, longer format works
for considered purchase):
Scene 1 (0-3s): Frustration moment — knife dulls, vegetable slides. Text: 'When your knife is dull, dinner takes forever'
Scene 2 (3-10s): Reveal sharpening tool. Voiceover: 'I had no idea sharpening could be this easy'
Scene 3 (10-20s): Product demo — 5 strokes, knife now slices tomato paper-thin. Multiple knife types shown.
Scene 4 (20-35s): Use cases: chef knife, paring, bread knife, scissors, even axe head. Time-lapse cooking session.
Scene 5 (35-45s): Founder/expert insert: '20 years in cutlery — this is the design I always wanted'
Scene 6 (45-55s): Customer reviews montage — 4-5 short cuts, names + occupations on screen. Text: 'Loved by chefs and home cooks'
Scene 7 (55-60s): Order CTA with bonus offer ('First 100 buyers get free knife oil'). Link in bio.`,
	},
	{
		source: "crossian/seed/07_ugc_authentic_pattern.md",
		contentType: "scene-pattern" as const,
		rawContent: `UGC authentic feel patterns (creator-generated content for dropshipping):
1. Selfie POV at arm's length — wobble OK, perfect framing kills authenticity
2. Hand entering frame — natural, not staged. Use one-handed phone hold
3. Off-screen voice with 1 person on camera — feels conversational
4. Bedroom/kitchen background, NOT studio — relatability > production value
5. Imperfect cuts — small jump cuts add rawness, don't smooth-blend everything
6. Real lighting (window or ring light), avoid 3-point pro setup
7. Show the product's box / unboxing wrinkle on inner foam — proves it's real
8. End with 'tag a friend who needs this' instead of hard CTA
Performance: UGC ads outperform polished ads 3-5x for cosmetics + apparel
under $50. Polished ads still win for $200+ tech / luxury.`,
	},
	{
		source: "crossian/seed/08_audience_segmentation.md",
		contentType: "scene-pattern" as const,
		rawContent: `Audience segmentation patterns for FB ad targeting + creative variation:
- ecom-buyer (25-45): Direct product benefit, skip identity framing. CTAs:
  'Shop now', 'Free shipping'. Visual: clean product shots + lifestyle.
- senior-50plus: Slow pace, voice-friendly script (avoid abbreviations,
  expand numbers), warm tone, larger text overlay. Pain-point hooks work
  best ('Tired of...'). Social proof = customer testimonials with names + ages.
- gen-z-tiktok: Trend audio + meme format, 9:16 vertical only. Hook 1.5s
  pattern interrupt. Text overlay essential (sound off viewing). Avoid
  formal voiceover. Comedy framing works.
- mom-baby: Convenience + safety messaging. Show product solving real-life
  scenarios (3am feedings, grocery runs). Trust badges: pediatrician
  recommended, BPA-free, organic. Slower pace, calm music.
- fitness-enthusiast: High-energy music, results montage (before/after),
  performance metrics. Avoid 'easy' framing — frame as 'tools for serious
  athletes'. Influencer with credentialed background works best.`,
	},
	{
		source: "crossian/seed/09_ctas_objection_handling.md",
		contentType: "text-overlay" as const,
		rawContent: `CTA + objection handling text overlay patterns (last 5-10s of ad):
Urgency CTAs:
- 'Limited stock — only X left'
- '24-hour flash sale'
- 'Today only: 50% OFF + Free shipping'
- 'Order in next 30 min for [delivery date]'

Risk reversal:
- '30-day money-back guarantee'
- 'Free returns, no questions'
- 'Try risk-free for 60 days'

Price anchoring:
- '$200 value, yours for $79'
- 'Salon costs $300 — get the same at home for $99'

Social proof CTAs:
- 'Join 50,000+ customers'
- 'Featured in [generic-publication]'
- 'Rated 4.8/5 by 12,000+ reviews'

Avoid: 'Buy now' (boring), specific competitor name comparisons (FB rejects),
unsubstantiated 'best/cheapest/strongest' claims.`,
	},
	{
		source: "crossian/seed/10_visual_treatment_by_platform.md",
		contentType: "scene-pattern" as const,
		rawContent: `Visual treatment by platform (creator's quick guide):
TikTok 9:16 30s:
- 1.5s scene cuts, max
- Trending audio overlay
- Subtitle ALL frames (sound off viewing)
- Bold colors, high contrast
- Pattern interrupt every 3s

Instagram Reels 9:16 30-60s:
- 2-3s scene cuts
- Higher production OK (still raw-ish)
- Music + voiceover both
- Aspirational lifestyle framing
- Caption supports visual story

Facebook feed 4:5 30-60s:
- 3-5s scene cuts
- Voiceover essential (older audience auto-plays sound)
- Slower pace, more product detail
- Reviews + testimonials carry weight
- CTA button overlay last 5s

YouTube Shorts 9:16 60s:
- 4-6s scene cuts
- Hook + payoff structure (longer attention)
- Educational tone works
- End screen with subscribe CTA

YouTube long-form 16:9 5-15min:
- 8-15s scene cuts
- Storytelling + demonstration
- Founder-led works
- Description CTA + pinned comment
- Chapter markers for retention`,
	},
];

async function main() {
	const prisma = new PrismaClient();
	try {
		console.log(`[seed-crossian-rag] Ingesting ${SAMPLES.length} samples...`);

		// Skip docs already present (idempotent re-runs).
		const existing = await prisma.ragDocument.findMany({
			where: { source: { in: SAMPLES.map((s) => s.source) } },
			select: { source: true },
		});
		const existingSources = new Set(existing.map((d) => d.source));
		const newDocs = SAMPLES.filter((s) => !existingSources.has(s.source));

		if (newDocs.length === 0) {
			console.log(`[seed-crossian-rag] All ${SAMPLES.length} samples already ingested.`);
			return;
		}

		const result = await ingestCrossianDocs(prisma, newDocs);
		console.log(`[seed-crossian-rag] Done:`);
		console.log(`  - Ingested: ${result.ingested}`);
		console.log(`  - Skipped (sanitize rules): ${result.skipped}`);
		console.log(`  - Already in DB: ${SAMPLES.length - newDocs.length}`);
		console.log(`  - Sample IDs: ${result.sanitized.map((s) => s.source.slice(-30)).join(", ")}`);
	} catch (err) {
		console.error("[seed-crossian-rag] Failed:", err);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

void main();
