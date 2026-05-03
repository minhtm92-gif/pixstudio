/**
 * Backfill embeddings for RAG documents (Sprint 36).
 *
 * Usage:
 *   flyctl ssh console -a pixstudio-api -C 'bun run /repo/apps/api/scripts/backfill-rag-embeddings.ts'
 *
 * Cost: ~$0.0001 per 100k chars input (Gemini text-embedding-004).
 * 10 seed docs ≈ negligible.
 *
 * Idempotent — only embeds docs with NULL embedding column.
 */

import { PrismaClient } from "@prisma/client";
import { backfillEmbeddings } from "../src/services/crossian-rag-ingest.js";

async function main() {
	const apiKey = process.env["GEMINI_API_KEY"];
	if (!apiKey) {
		console.error("GEMINI_API_KEY not set in env");
		process.exit(1);
	}

	const prisma = new PrismaClient();
	try {
		console.log("[backfill-rag] Starting batch embedding...");
		let totalEmbedded = 0;
		let totalSkipped = 0;
		while (true) {
			const result = await backfillEmbeddings(prisma, apiKey, 50);
			totalEmbedded += result.embedded;
			totalSkipped += result.skipped;
			console.log(`  batch: ${result.embedded} embedded, ${result.skipped} skipped`);
			if (result.embedded === 0) break;
		}
		console.log(`[backfill-rag] Done: ${totalEmbedded} embedded, ${totalSkipped} skipped`);
	} catch (err) {
		console.error("[backfill-rag] Failed:", err);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

void main();
