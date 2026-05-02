/**
 * Crossian RAG ingest service — Sprint 6.
 *
 * Reads sanitized EN dropshipping/facebook-ad content from
 * `D:\Workspace\Crossian Research\Knowhow_for_AI_Agent\` (path local on dev box,
 * synced to /opt/crossian-kb on Fly via R2 backup), applies sanitize rules
 * (Q67 + Q68 + Q72 filter), embeds via Gemini text-embedding-004 (1536 dim),
 * stores in pgvector for similarity search.
 *
 * Sanitize rules (Q68 + scope addition):
 *  1. Replace brand names → "[brand]"
 *  2. Round benchmarks (e.g. "ROAS 4.2x" → "ROAS 3-5x")
 *  3. Drop COGS / margin numbers
 *  4. Drop Slack handles + roster names
 *  5. Drop specific URLs (FB ad library / Stripe / Slack invite links)
 *  6. Skip non-EN content
 *  7. Skip non-sales (entertainment / edu / personal blog)
 *
 * Run as one-time admin script OR scheduled cron (manual trigger only — content
 * doesn't change frequently).
 */

import type { PrismaClient } from "@prisma/client";

interface CrossianDocInput {
	source: string; // e.g. "crossian/05_Video_Analysis/scene_breakdown.md"
	contentType: "scene-pattern" | "hook-template" | "ad-script" | "text-overlay";
	rawContent: string;
}

interface SanitizedDoc {
	source: string;
	contentType: string;
	content: string;
	appliedRules: string[];
}

const BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
	// Add specific brand names from Crossian KB to replace with [brand]
	[/\b(Crossian|Crossian LLC)\b/gi, "[brand]"],
	[/\bSelless\b/g, "[brand-platform]"],
];

const URL_PATTERNS_TO_DROP: RegExp[] = [
	/https:\/\/[a-z0-9.-]*facebook\.com\/ads\/library[^\s)]+/gi,
	/https:\/\/(?:checkout|js|api)\.stripe\.com[^\s)]+/gi,
	/https:\/\/[a-z0-9-]+\.slack\.com[^\s)]+/gi,
	/(?:slack\.com\/archives|app\.slack\.com)[^\s)]+/gi,
];

const COGS_PATTERNS: RegExp[] = [
	/\b(?:cogs|cost of goods sold|margin)\s*[:=]\s*\$?[\d,.]+%?/gi,
	/\b\$?[\d,.]+\s*(?:cogs|margin)\b/gi,
];

const SLACK_HANDLE_PATTERN = /@[a-z0-9._-]+|<@[A-Z0-9]+>/g;

/**
 * Apply Q68 sanitize rules. Returns sanitized text + list of applied rules.
 */
export function sanitizeCrossianContent(
	source: string,
	contentType: string,
	rawContent: string,
): SanitizedDoc | null {
	const appliedRules: string[] = [];
	let content = rawContent;

	// Rule 6: skip non-EN (basic heuristic — check for Vietnamese diacritics density)
	const vnDiacritics = (content.match(/[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶ]/g) ?? []).length;
	if (vnDiacritics > 20) {
		return null; // non-EN content, skip
	}

	// Rule 1: brand name replacement
	for (const [pattern, replacement] of BRAND_REPLACEMENTS) {
		if (pattern.test(content)) {
			content = content.replace(pattern, replacement);
			appliedRules.push("brand-replace");
		}
	}

	// Rule 2: round benchmarks (heuristic — replace specific decimals with ranges)
	content = content.replace(/\b(ROAS|ROI|CTR|CPC|CPM|CR)\s*[:=]?\s*([\d.]+)([%x]?)/gi, (_, metric, val, suffix) => {
		appliedRules.push("round-benchmarks");
		const num = parseFloat(val);
		const low = Math.floor(num);
		const high = Math.ceil(num + 1);
		return `${metric} ${low}-${high}${suffix}`;
	});

	// Rule 3: drop COGS / margin
	for (const pattern of COGS_PATTERNS) {
		if (pattern.test(content)) {
			content = content.replace(pattern, "[financial-redacted]");
			appliedRules.push("drop-cogs");
		}
	}

	// Rule 4: drop Slack handles
	if (SLACK_HANDLE_PATTERN.test(content)) {
		content = content.replace(SLACK_HANDLE_PATTERN, "[user]");
		appliedRules.push("drop-slack-handles");
	}

	// Rule 5: drop specific URLs
	for (const pattern of URL_PATTERNS_TO_DROP) {
		if (pattern.test(content)) {
			content = content.replace(pattern, "[url-redacted]");
			appliedRules.push("drop-urls");
		}
	}

	// Rule 7: skip if no commercial intent signals (loose heuristic)
	const salesSignals = /\b(ad|ads|advertis|dropship|facebook ad|fb ad|shopify|conversion|funnel|hook|cta|call-to-action|stripe|checkout|landing page|product page)\b/gi;
	if (!salesSignals.test(rawContent)) {
		return null; // skip non-sales content
	}

	return {
		source,
		contentType,
		content,
		appliedRules: [...new Set(appliedRules)],
	};
}

/**
 * Ingest a batch of Crossian docs into rag_documents table.
 * Embedding generation deferred Sprint 6 polish (Gemini text-embedding-004
 * call + ALTER TABLE add embedding vector(1536) column).
 *
 * v1: stores raw sanitized text, similarity = LIKE / full-text search fallback.
 */
export async function ingestCrossianDocs(
	prisma: PrismaClient,
	docs: CrossianDocInput[],
): Promise<{ ingested: number; skipped: number; sanitized: SanitizedDoc[] }> {
	const sanitized: SanitizedDoc[] = [];
	let skipped = 0;

	for (const doc of docs) {
		const result = sanitizeCrossianContent(doc.source, doc.contentType, doc.rawContent);
		if (!result) {
			skipped++;
			continue;
		}
		sanitized.push(result);
	}

	if (sanitized.length === 0) {
		return { ingested: 0, skipped, sanitized: [] };
	}

	// Bulk insert. workflowTags = ["dropshipping", "facebook-ad"] applied by default
	// since we filter to commercial-intent EN content only (rules 6+7).
	await prisma.ragDocument.createMany({
		data: sanitized.map((s) => ({
			source: s.source,
			contentType: s.contentType,
			workflowTags: ["dropshipping", "facebook-ad"],
			language: "en",
			content: s.content,
			sanitizeRules: s.appliedRules,
		})),
	});

	return { ingested: sanitized.length, skipped, sanitized };
}

/**
 * Sprint 6 polish: pgvector similarity search.
 * v1: simple full-text LIKE matching across sanitized content.
 */
export async function searchCrossianContext(
	prisma: PrismaClient,
	query: string,
	limit: number = 3,
): Promise<Array<{ source: string; content: string; contentType: string }>> {
	// Sprint 6 polish: replace with pgvector cosine similarity:
	// SELECT * FROM rag_documents
	// ORDER BY embedding <=> $queryEmbedding
	// LIMIT $limit;
	const docs = await prisma.ragDocument.findMany({
		where: {
			AND: [
				{ language: "en" },
				{
					OR: query.split(/\s+/).filter((w) => w.length > 2).map((word) => ({
						content: { contains: word, mode: "insensitive" as const },
					})),
				},
			],
		},
		take: limit,
		orderBy: { createdAt: "desc" },
	});

	return docs.map((d) => ({
		source: d.source,
		content: d.content.slice(0, 2000), // cap context size for LLM injection
		contentType: d.contentType,
	}));
}
