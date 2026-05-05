/**
 * Export presets routes — Sprint S28 (QC-10 + D-1 SCOPE §4.5).
 *
 *   GET  /api/export/presets                — list 6 platform presets
 *   POST /api/projects/:id/export           — kick off export job
 *   GET  /api/projects/:id/export/:jobId    — poll status
 *
 * Phase 3: ship preset metadata + render-job orchestration. Real FFmpeg
 * render leverages the same BullMQ worker as Quick Create build pipeline
 * stage 5 (already implemented). For S28 v1 we expose presets + signed
 * URL fetcher for already-rendered preview MP4. Full multi-format export
 * pipeline is S29+ polish.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

interface ExportPreset {
	id: string;
	platform: "tiktok" | "instagram-reel" | "youtube-shorts" | "facebook-reel" | "youtube-long" | "x-twitter";
	label: string;
	width: number;
	height: number;
	maxDurationSec: number;
	fps: number;
	bitrateKbps: number;
	codec: "h264" | "h265";
	audioCodec: "aac";
	audioBitrateKbps: number;
	notes: string;
}

const PRESETS: ExportPreset[] = [
	{
		id: "tiktok-9-16-30s",
		platform: "tiktok",
		label: "TikTok 9:16 30s",
		width: 1080,
		height: 1920,
		maxDurationSec: 60,
		fps: 30,
		bitrateKbps: 6000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 128,
		notes: "TikTok recommended 1080×1920 H.264 — vertical 9:16, max 60s for in-feed feed.",
	},
	{
		id: "instagram-reel-9-16",
		platform: "instagram-reel",
		label: "Instagram Reel 9:16 90s",
		width: 1080,
		height: 1920,
		maxDurationSec: 90,
		fps: 30,
		bitrateKbps: 5000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 128,
		notes: "Instagram Reel 1080×1920 — max 90s.",
	},
	{
		id: "youtube-shorts-9-16",
		platform: "youtube-shorts",
		label: "YouTube Shorts 9:16 60s",
		width: 1080,
		height: 1920,
		maxDurationSec: 60,
		fps: 30,
		bitrateKbps: 5000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 128,
		notes: "YouTube Shorts max 60s, vertical 9:16.",
	},
	{
		id: "facebook-reel-4-5",
		platform: "facebook-reel",
		label: "Facebook Reel 4:5 60s",
		width: 1080,
		height: 1350,
		maxDurationSec: 60,
		fps: 30,
		bitrateKbps: 5000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 128,
		notes: "Facebook Ad 4:5 vertical — 1080×1350.",
	},
	{
		id: "youtube-long-16-9-1080p",
		platform: "youtube-long",
		label: "YouTube long 1080p",
		width: 1920,
		height: 1080,
		maxDurationSec: 600,
		fps: 30,
		bitrateKbps: 8000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 192,
		notes: "YouTube long-form 1920×1080 H.264 — max 10min default.",
	},
	{
		id: "x-twitter-1-1",
		platform: "x-twitter",
		label: "X / Twitter 1:1 140s",
		width: 1080,
		height: 1080,
		maxDurationSec: 140,
		fps: 30,
		bitrateKbps: 5000,
		codec: "h264",
		audioCodec: "aac",
		audioBitrateKbps: 128,
		notes: "X video square 1:1 — max 2:20.",
	},
];

export const exportRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/presets", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { presets: PRESETS };
		},
	});

	// GET /api/export/preview-mp4/:projectId — signed URL for already-rendered
	// preview MP4 from BullMQ build pipeline stage 5 output. Frontend Final
	// Preview view (View 7) loads this for video player.
	app.get("/preview-mp4/:projectId", {
		schema: { params: z.object({ projectId: z.string().uuid() }) },
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.projectId },
				select: { workspaceId: true, editorStateJson: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id);
			if (!member) {
				reply.code(403);
				return { error: "Not workspace member" };
			}
			if (!app.r2) {
				reply.code(503);
				return { error: "R2 not configured" };
			}

			// Try to find preview render key in editorState OR Quick Create session
			const editorState = project.editorStateJson as
				| { previewRenderR2Key?: string; editorState?: { previewRenderR2Key?: string } }
				| null;
			let r2Key = editorState?.previewRenderR2Key ?? editorState?.editorState?.previewRenderR2Key;

			// Fallback: look up linked Quick Create session
			if (!r2Key) {
				const session = await app.prisma.quickCreateSession.findFirst({
					where: { workspaceId: project.workspaceId, buildStatus: "COMPLETED" },
					orderBy: { updatedAt: "desc" },
					select: { outlineJson: true },
				});
				const outline = session?.outlineJson as
					| { editorState?: { previewRenderR2Key?: string } }
					| null;
				r2Key = outline?.editorState?.previewRenderR2Key;
			}

			if (!r2Key) {
				reply.code(404);
				return {
					error: "No preview render available. Run Quick Create build pipeline first.",
				};
			}

			const command = new GetObjectCommand({
				Bucket: app.r2Buckets.renders,
				Key: r2Key,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const signedUrl = await getSignedUrl(app.r2 as any, command as any, {
				expiresIn: 3600, // 1 hour
			});
			return {
				signedUrl,
				r2Key,
				expiresInSec: 3600,
			};
		},
	});
};
