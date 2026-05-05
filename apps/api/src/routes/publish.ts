/**
 * Publish connectors — Sprint S29 (D-3 + D-4 + D-5 SCOPE §4.5).
 *
 * Scope: TikTok / Meta Reel / YouTube Shorts publish endpoints. Phase 3
 * ships OAuth-flow shell endpoints — actual platform credentials require
 * anh apply for partner API access (see SCOPE blockers).
 *
 *   GET  /api/publish/connectors              — list available platforms + OAuth state
 *   POST /api/publish/oauth/start             — begin OAuth flow (returns auth URL)
 *   POST /api/publish/oauth/callback          — exchange code for refresh token
 *   POST /api/publish/projects/:id/publish    — publish project to platform
 *   GET  /api/publish/projects/:id/status     — list publish jobs + statuses
 *
 * Until platform OAuth credentials provided by anh, these endpoints return
 * structured "not configured" responses so frontend can render the
 * connect-account UI without breaking.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser, requireWorkspaceMember } from "../plugins/require-auth.js";

interface ConnectorMeta {
	platform: "tiktok" | "meta-reel" | "youtube-shorts";
	displayName: string;
	configured: boolean;
	requiredEnvVars: string[];
	oauthScopes: string[];
	apiDocsUrl: string;
}

const CONNECTORS: ConnectorMeta[] = [
	{
		platform: "tiktok",
		displayName: "TikTok",
		configured: !!process.env["TIKTOK_CLIENT_KEY"] && !!process.env["TIKTOK_CLIENT_SECRET"],
		requiredEnvVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
		oauthScopes: ["video.upload", "video.publish"],
		apiDocsUrl: "https://developers.tiktok.com/doc/tiktok-api-v2-video-publish/",
	},
	{
		platform: "meta-reel",
		displayName: "Facebook & Instagram Reels",
		configured: !!process.env["META_APP_ID"] && !!process.env["META_APP_SECRET"],
		requiredEnvVars: ["META_APP_ID", "META_APP_SECRET"],
		oauthScopes: ["instagram_content_publish", "pages_read_engagement", "pages_manage_posts"],
		apiDocsUrl: "https://developers.facebook.com/docs/instagram-api/guides/content-publishing",
	},
	{
		platform: "youtube-shorts",
		displayName: "YouTube Shorts",
		configured:
			!!process.env["YOUTUBE_CLIENT_ID"] && !!process.env["YOUTUBE_CLIENT_SECRET"],
		requiredEnvVars: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
		oauthScopes: ["https://www.googleapis.com/auth/youtube.upload"],
		apiDocsUrl: "https://developers.google.com/youtube/v3/docs/videos/insert",
	},
];

export const publishRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get("/connectors", {
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			return { items: CONNECTORS };
		},
	});

	app.post("/oauth/start", {
		schema: {
			body: z.object({
				platform: z.enum(["tiktok", "meta-reel", "youtube-shorts"]),
				workspaceId: z.string().uuid(),
				redirectUri: z.string().url(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const member = await requireWorkspaceMember(app, req.body.workspaceId, user.id, "OWNER");
			if (!member) {
				reply.code(403);
				return { error: "Only workspace OWNER can connect publish accounts" };
			}
			const connector = CONNECTORS.find((c) => c.platform === req.body.platform);
			if (!connector?.configured) {
				reply.code(503);
				return {
					error: "Platform credentials not configured",
					message: `Anh need to set ${connector?.requiredEnvVars.join(" + ")} on Fly. Apply for partner API access at: ${connector?.apiDocsUrl}`,
				};
			}
			// Real impl: build platform-specific authorization URL with state token.
			reply.code(501);
			return {
				error: "OAuth flow not implemented",
				message: `Platform ${req.body.platform} credentials are configured but OAuth flow code is S30+ work. Returns 501 until anh's partner API approval lands.`,
				configuredEnvVars: connector.requiredEnvVars,
			};
		},
	});

	app.post("/projects/:id/publish", {
		schema: {
			params: z.object({ id: z.string().uuid() }),
			body: z.object({
				platform: z.enum(["tiktok", "meta-reel", "youtube-shorts"]),
				caption: z.string().max(2200).optional(),
				hashtags: z.array(z.string()).max(30).optional(),
				scheduledAt: z.string().datetime().optional(),
			}),
		},
		handler: async (req, reply) => {
			const user = requireUser(req, reply);
			if (!user) return;
			const project = await app.prisma.project.findUnique({
				where: { id: req.params.id },
				select: { workspaceId: true },
			});
			if (!project) {
				reply.code(404);
				return { error: "Project not found" };
			}
			const member = await requireWorkspaceMember(app, project.workspaceId, user.id, "EDITOR");
			if (!member) {
				reply.code(403);
				return { error: "Need EDITOR or OWNER role" };
			}
			const connector = CONNECTORS.find((c) => c.platform === req.body.platform);
			reply.code(501);
			return {
				error: "Platform publish not implemented",
				message: `${connector?.displayName ?? req.body.platform} connector requires partner API credentials. Currently returning 501. Once OAuth flow is wired (S30+ post-credentials), this will enqueue a publish job and return jobId for polling.`,
				configured: connector?.configured ?? false,
			};
		},
	});
};
