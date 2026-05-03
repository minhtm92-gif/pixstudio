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

// SCOPE §6 mandates brand sanitize. Per Crossian KB explicit brand mentions:
// JetJeans / StretchActive / SonaShape (anh Minh confirmed 2026-05-01 round 4).
// Plus generic Crossian + Selless platform reference + ad/pixel/campaign IDs.
const BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
	[/\b(Crossian|Crossian LLC)\b/gi, "[brand]"],
	[/\bSelless\b/g, "[brand-platform]"],
	[/\bJetJeans\b/gi, "[brand]"],
	[/\bStretchActive\b/gi, "[brand]"],
	[/\bSonaShape\b/gi, "[brand]"],
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

// SCOPE §6 DROP list — real campaign IDs, ad account IDs, pixel IDs.
const ID_DROP_PATTERNS: RegExp[] = [
	/\bact_\d{6,}\b/gi, // Facebook ad account IDs
	/\bpx_[\w-]{8,}\b/gi, // Pixel IDs
	/\bcamp_[\w-]{8,}\b/gi, // Campaign IDs
	/\b[0-9a-f]{32}\b/gi, // 32-char hex (often Pixel/event IDs)
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

	// Rule 5b: drop FB ad account / pixel / campaign IDs
	for (const pattern of ID_DROP_PATTERNS) {
		if (pattern.test(content)) {
			content = content.replace(pattern, "[id-redacted]");
			appliedRules.push("drop-ids");
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
 * Generate embedding via Gemini gemini-embedding-001 (768-dim, configurable).
 *
 * Old text-embedding-004 model deprecated 2026-Q1 — replaced by
 * gemini-embedding-001 which supports outputDimensionality param.
 * We request 768 to match existing pgvector schema column.
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
	if (!apiKey) return null;
	const truncated = text.slice(0, 8000);
	const resp = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "models/gemini-embedding-001",
				content: { parts: [{ text: truncated }] },
				outputDimensionality: 768,
				taskType: "RETRIEVAL_DOCUMENT",
			}),
		},
	);
	if (!resp.ok) return null;
	const json = (await resp.json()) as { embedding?: { values?: number[] } };
	return json.embedding?.values ?? null;
}

/**
 * Sprint 36: pgvector cosine similarity search via Gemini embedding.
 * Falls back to LIKE matching if Gemini API unavailable or no embeddings yet.
 */
export async function searchCrossianContext(
	prisma: PrismaClient,
	query: string,
	limit: number = 3,
	geminiApiKey?: string,
): Promise<Array<{ source: string; content: string; contentType: string; similarity?: number }>> {
	if (geminiApiKey) {
		try {
			// Note: query embedding uses RETRIEVAL_QUERY task — but Gemini
			// gemini-embedding-001 only sets task at index time. For query side
			// we just reuse same fn (good enough for cosine similarity).
			const embedding = await generateEmbedding(query, geminiApiKey);
			if (embedding && embedding.length > 0) {
				const vectorLiteral = `[${embedding.join(",")}]`;
				const rows = (await prisma.$queryRawUnsafe(
					`SELECT source, content, "contentType", 1 - (embedding <=> $1::vector) AS similarity
					 FROM rag_documents
					 WHERE language = 'en' AND embedding IS NOT NULL
					 ORDER BY embedding <=> $1::vector
					 LIMIT $2`,
					vectorLiteral,
					limit,
				)) as Array<{ source: string; content: string; contentType: string; similarity: number }>;
				if (rows.length > 0) {
					return rows.map((r) => ({
						source: r.source,
						content: r.content.slice(0, 2000),
						contentType: r.contentType,
						similarity: r.similarity,
					}));
				}
			}
		} catch (err) {
			console.warn("[crossian-rag] pgvector failed, fallback LIKE:", err);
		}
	}

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
		content: d.content.slice(0, 2000),
		contentType: d.contentType,
	}));
}

/**
 * Backfill embeddings for existing RagDocument rows. Run once after seed.
 */
export async function backfillEmbeddings(
	prisma: PrismaClient,
	geminiApiKey: string,
	batchSize: number = 50,
): Promise<{ embedded: number; skipped: number }> {
	const docsRaw = (await prisma.$queryRawUnsafe(
		`SELECT id, content FROM rag_documents WHERE embedding IS NULL LIMIT $1`,
		batchSize,
	)) as Array<{ id: string; content: string }>;

	let embedded = 0;
	let skipped = 0;

	for (const doc of docsRaw) {
		const embedding = await generateEmbedding(doc.content, geminiApiKey);
		if (!embedding) {
			skipped++;
			continue;
		}
		const vectorLiteral = `[${embedding.join(",")}]`;
		await prisma.$executeRawUnsafe(
			`UPDATE rag_documents SET embedding = $1::vector WHERE id = $2`,
			vectorLiteral,
			doc.id,
		);
		embedded++;
	}

	return { embedded, skipped };
}
