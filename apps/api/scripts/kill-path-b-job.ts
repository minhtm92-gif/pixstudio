/**
 * Kill a ReverseEngineerJob by partial or full ID prefix.
 *
 * Usage:
 *   bun run apps/api/scripts/kill-path-b-job.ts 7f27d90a
 *   flyctl ssh console -a pixstudio-api -C 'bun run /repo/apps/api/scripts/kill-path-b-job.ts 7f27d90a'
 *
 * Sets status=CANCELLED in DB. Background pipeline exits at next stage check
 * (typically <30s). Replicate predictions in flight may continue billing for
 * 1-2 min more — Replicate doesn't expose abort API.
 */

import { PrismaClient } from "@prisma/client";

async function main() {
	const idPrefix = process.argv[2];
	if (!idPrefix || idPrefix.length < 4) {
		console.error("Usage: bun run apps/api/scripts/kill-path-b-job.ts <id-prefix>");
		process.exit(1);
	}

	const prisma = new PrismaClient();
	try {
		// Try exact match first (full UUID), then prefix
		const exact = await prisma.reverseEngineerJob.findUnique({
			where: { id: idPrefix },
		}).catch(() => null);

		const jobs = exact
			? [exact]
			: await prisma.$queryRaw<Array<{ id: string; status: string; sourceUrl: string | null }>>`
				SELECT id, status, "sourceUrl" FROM reverse_engineer_jobs
				WHERE id::text LIKE ${idPrefix + "%"}
				ORDER BY "createdAt" DESC LIMIT 5
			`;

		if (jobs.length === 0) {
			console.error(`No job found with id prefix "${idPrefix}"`);
			process.exit(1);
		}

		for (const job of jobs) {
			if (job.status === "CANCELLED" || job.status === "COMPLETED" || job.status === "FAILED") {
				console.log(`✓ Job ${job.id.slice(0, 8)} already ${job.status} — no-op`);
				continue;
			}
			await prisma.reverseEngineerJob.update({
				where: { id: job.id },
				data: {
					status: "CANCELLED",
					errorMessage: "Killed via admin script",
					completedAt: new Date(),
				},
			});
			console.log(`✓ Killed job ${job.id.slice(0, 8)} (was ${job.status})`);
			console.log(`  Source: ${job.sourceUrl ?? "unknown"}`);
		}
		console.log(`\nNote: background pipeline exits at next stage check (~30s).`);
		console.log(`Replicate predictions already submitted may complete billing.`);
	} catch (err) {
		console.error("Failed:", err);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

void main();
