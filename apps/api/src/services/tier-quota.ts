/**
 * Tier quota service — Sprint 6 enforcement.
 *
 * Per Q41 anh chốt:
 *   Standard: 5 builds/month, 5min Path B, 50 voices, 720p, watermark on, last queue
 *   Pro:      50 builds/month, 30min Path B, 200 voices, 1080p, no watermark, mid queue
 *   Max:      unlimited builds, 120min Path B, all voices + cloning, 4K, first queue
 *
 * Path B minutes = source video duration (cap 120min/mo Max).
 * Voice preview cap: 10/session (Q28) tracked via voicePreviewsCount.
 */

import type { PrismaClient } from "@prisma/client";

export type Tier = "STANDARD" | "PRO" | "MAX";

export interface TierLimits {
	buildsPerMonth: number; // -1 = unlimited
	pathBMinutesPerMonth: number;
	voicePoolSize: number; // -1 = all
	exportResolution: "720p" | "1080p" | "4K";
	watermark: boolean;
	queuePriority: "first" | "mid" | "last";
	voiceCloningAvailable: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
	STANDARD: {
		buildsPerMonth: 5,
		pathBMinutesPerMonth: 5,
		voicePoolSize: 50,
		exportResolution: "720p",
		watermark: true,
		queuePriority: "last",
		voiceCloningAvailable: false,
	},
	PRO: {
		buildsPerMonth: 50,
		pathBMinutesPerMonth: 30,
		voicePoolSize: 200,
		exportResolution: "1080p",
		watermark: false,
		queuePriority: "mid",
		voiceCloningAvailable: false,
	},
	MAX: {
		buildsPerMonth: -1,
		pathBMinutesPerMonth: 120,
		voicePoolSize: -1,
		exportResolution: "4K",
		watermark: false,
		queuePriority: "first",
		voiceCloningAvailable: true,
	},
};

export type QuotaCheck =
	| { allowed: true; remainingBuilds: number; remainingPathBMinutes: number }
	| {
			allowed: false;
			reason: "build-cap" | "path-b-cap" | "voice-pool-cap";
			limit: number;
			used: number;
			tier: Tier;
	  };

const monthYearKey = (date = new Date()) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * Idempotent get-or-create UsageTracker row for current month.
 */
async function getOrCreateTracker(prisma: PrismaClient, workspaceId: string) {
	const monthYear = monthYearKey();
	return prisma.usageTracker.upsert({
		where: { workspaceId_monthYear: { workspaceId, monthYear } },
		create: { workspaceId, monthYear },
		update: {},
	});
}

/**
 * Check if workspace can start a new Quick Create build.
 * Returns allowed=true with remaining counts, OR allowed=false with reason.
 */
export async function checkBuildQuota(
	prisma: PrismaClient,
	workspaceId: string,
): Promise<QuotaCheck> {
	const ws = await prisma.workspace.findUnique({
		where: { id: workspaceId },
		select: { billingTier: true },
	});
	if (!ws) {
		return { allowed: false, reason: "build-cap", limit: 0, used: 0, tier: "STANDARD" };
	}
	const tier = ws.billingTier as Tier;
	const limits = TIER_LIMITS[tier];

	const tracker = await getOrCreateTracker(prisma, workspaceId);

	if (limits.buildsPerMonth !== -1 && tracker.buildsCount >= limits.buildsPerMonth) {
		return {
			allowed: false,
			reason: "build-cap",
			limit: limits.buildsPerMonth,
			used: tracker.buildsCount,
			tier,
		};
	}

	const remainingBuilds =
		limits.buildsPerMonth === -1
			? Infinity
			: limits.buildsPerMonth - tracker.buildsCount;
	const remainingPathBMinutes =
		limits.pathBMinutesPerMonth - Number(tracker.pathBMinutes);

	return {
		allowed: true,
		remainingBuilds: remainingBuilds === Infinity ? -1 : remainingBuilds,
		remainingPathBMinutes,
	};
}

/**
 * Check Path B reverse engineer quota (charged in minutes of source video).
 */
export async function checkPathBQuota(
	prisma: PrismaClient,
	workspaceId: string,
	estimatedMinutes: number,
): Promise<QuotaCheck> {
	const ws = await prisma.workspace.findUnique({
		where: { id: workspaceId },
		select: { billingTier: true },
	});
	if (!ws) {
		return { allowed: false, reason: "path-b-cap", limit: 0, used: 0, tier: "STANDARD" };
	}
	const tier = ws.billingTier as Tier;
	const limits = TIER_LIMITS[tier];

	const tracker = await getOrCreateTracker(prisma, workspaceId);
	const used = Number(tracker.pathBMinutes);

	if (used + estimatedMinutes > limits.pathBMinutesPerMonth) {
		return {
			allowed: false,
			reason: "path-b-cap",
			limit: limits.pathBMinutesPerMonth,
			used,
			tier,
		};
	}

	return {
		allowed: true,
		remainingBuilds: limits.buildsPerMonth === -1 ? -1 : Infinity,
		remainingPathBMinutes: limits.pathBMinutesPerMonth - used,
	};
}

/**
 * Increment build counter after successful build kickoff.
 */
export async function incrementBuildCount(
	prisma: PrismaClient,
	workspaceId: string,
	costUsd: number = 0,
): Promise<void> {
	const monthYear = monthYearKey();
	await prisma.usageTracker.upsert({
		where: { workspaceId_monthYear: { workspaceId, monthYear } },
		create: {
			workspaceId,
			monthYear,
			buildsCount: 1,
			totalCostUsd: costUsd,
		},
		update: {
			buildsCount: { increment: 1 },
			totalCostUsd: { increment: costUsd },
		},
	});
}

export async function incrementPathBMinutes(
	prisma: PrismaClient,
	workspaceId: string,
	minutes: number,
	costUsd: number = 0,
): Promise<void> {
	const monthYear = monthYearKey();
	await prisma.usageTracker.upsert({
		where: { workspaceId_monthYear: { workspaceId, monthYear } },
		create: {
			workspaceId,
			monthYear,
			pathBMinutes: minutes,
			totalCostUsd: costUsd,
		},
		update: {
			pathBMinutes: { increment: minutes },
			totalCostUsd: { increment: costUsd },
		},
	});
}

export async function incrementVoicePreviews(
	prisma: PrismaClient,
	workspaceId: string,
): Promise<void> {
	const monthYear = monthYearKey();
	await prisma.usageTracker.upsert({
		where: { workspaceId_monthYear: { workspaceId, monthYear } },
		create: { workspaceId, monthYear, voicePreviewsCount: 1 },
		update: { voicePreviewsCount: { increment: 1 } },
	});
}

/**
 * Get current usage summary for workspace (admin/UI dashboard).
 */
export async function getUsageSummary(
	prisma: PrismaClient,
	workspaceId: string,
) {
	const ws = await prisma.workspace.findUnique({
		where: { id: workspaceId },
		select: { billingTier: true },
	});
	if (!ws) return null;

	const tier = ws.billingTier as Tier;
	const limits = TIER_LIMITS[tier];
	const tracker = await getOrCreateTracker(prisma, workspaceId);

	return {
		tier,
		monthYear: tracker.monthYear,
		usage: {
			buildsCount: tracker.buildsCount,
			buildsLimit: limits.buildsPerMonth,
			pathBMinutes: Number(tracker.pathBMinutes),
			pathBLimit: limits.pathBMinutesPerMonth,
			voicePreviewsCount: tracker.voicePreviewsCount,
			totalCostUsd: Number(tracker.totalCostUsd),
		},
		limits,
	};
}
