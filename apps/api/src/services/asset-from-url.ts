/**
 * Asset auto-create from URL — Sprint S19.
 *
 * Helper used by AI gen routes (image/video/voice) and stock vendor download
 * to convert an external URL → R2 upload → Asset row. Returns Asset.id ready
 * for editor timeline insertion.
 *
 * Asset model requires projectId — for workspace-level operations (Asset
 * Studio AI gen without active project), auto-create a "Library" Project
 * per workspace on first use.
 */

import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";

// Match Prisma enums (apps/api/prisma/schema.prisma)
type AssetType =
	| "VIDEO"
	| "IMAGE"
	| "MUSIC"
	| "CHARACTER"
	| "SCRIPT"
	| "TTS_AUDIO"
	| "AI_GEN_IMAGE"
	| "AI_GEN_VIDEO";

type AssetSource = "USER_UPLOAD" | "STOCK_POOL" | "AI_GEN" | "TEMPLATE";

interface SaveOptions {
	prisma: PrismaClient;
	r2: S3Client;
	r2Bucket: string;
	workspaceId: string;
	/** If absent, helper finds-or-creates a "Library" project for the workspace. */
	projectId?: string;
	type: AssetType;
	/** Either a public URL (we fetch + upload) OR raw Buffer (already in memory). */
	sourceUrl?: string;
	sourceBuffer?: Buffer;
	displayName?: string;
	mimeType?: string;
	source?: AssetSource;
	metadata?: Record<string, unknown>;
}

interface SaveResult {
	assetId: string;
	r2Key: string;
	sizeBytes: number;
	mimeType: string;
}

const LIBRARY_PROJECT_NAME = "Library (auto)";

async function getOrCreateLibraryProject(
	prisma: PrismaClient,
	workspaceId: string,
): Promise<string> {
	const existing = await prisma.project.findFirst({
		where: {
			workspaceId,
			name: LIBRARY_PROJECT_NAME,
		},
		select: { id: true },
	});
	if (existing) return existing.id;
	const created = await prisma.project.create({
		data: {
			workspaceId,
			name: LIBRARY_PROJECT_NAME,
			description:
				"Auto-created holder for Asset Studio AI gen + stock downloads. Do not delete.",
			lastEditedAt: new Date(),
		},
		select: { id: true },
	});
	return created.id;
}

function inferType(mimeType: string): AssetType {
	if (mimeType.startsWith("video/")) return "VIDEO";
	if (mimeType.startsWith("image/")) return "IMAGE";
	if (mimeType.startsWith("audio/")) return "MUSIC";
	return "SCRIPT";
}

function r2KeyForAsset(workspaceId: string, type: AssetType, ext: string): string {
	const folder = type.toLowerCase();
	const ts = Date.now();
	const rand = Math.random().toString(36).slice(2, 8);
	return `assets/${workspaceId}/${folder}/${ts}-${rand}${ext}`;
}

export async function saveAssetFromUrl(opts: SaveOptions): Promise<SaveResult> {
	// Either fetch URL or use direct buffer
	let buf: Buffer;
	let detectedMime: string;
	if (opts.sourceBuffer) {
		buf = opts.sourceBuffer;
		detectedMime = opts.mimeType ?? "application/octet-stream";
	} else if (opts.sourceUrl) {
		const resp = await fetch(opts.sourceUrl);
		if (!resp.ok) {
			throw new Error(`Fetch source ${resp.status}: ${opts.sourceUrl.slice(0, 80)}`);
		}
		buf = Buffer.from(await resp.arrayBuffer());
		detectedMime =
			opts.mimeType ?? resp.headers.get("content-type") ?? "application/octet-stream";
	} else {
		throw new Error("saveAssetFromUrl: provide either sourceUrl or sourceBuffer");
	}
	const type = inferType(detectedMime);

	// Determine extension from MIME
	const extMap: Record<string, string> = {
		"video/mp4": ".mp4",
		"video/webm": ".webm",
		"video/quicktime": ".mov",
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/webp": ".webp",
		"audio/mpeg": ".mp3",
		"audio/wav": ".wav",
		"audio/mp4": ".m4a",
	};
	const ext = extMap[detectedMime] ?? "";

	const r2Key = r2KeyForAsset(opts.workspaceId, type, ext);
	await opts.r2.send(
		new PutObjectCommand({
			Bucket: opts.r2Bucket,
			Key: r2Key,
			Body: buf,
			ContentType: detectedMime,
		}),
	);

	const projectId =
		opts.projectId ?? (await getOrCreateLibraryProject(opts.prisma, opts.workspaceId));

	const asset = await opts.prisma.asset.create({
		data: {
			projectId,
			type,
			source: opts.source ?? "AI_GEN",
			name: opts.displayName ?? r2Key.split("/").pop() ?? "asset",
			r2Key,
			mimeType: detectedMime,
			sizeBytes: BigInt(buf.length),
			metadata: (opts.metadata ?? {}) as never,
		},
		select: { id: true },
	});

	return {
		assetId: asset.id,
		r2Key,
		sizeBytes: buf.length,
		mimeType: detectedMime,
	};
}
