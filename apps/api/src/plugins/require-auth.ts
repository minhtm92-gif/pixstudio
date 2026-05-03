/**
 * Auth middleware — populates `req.user` from better-auth session cookie/token.
 *
 * Public routes (skipped):
 *   - /health, /health/*
 *   - /api/auth/*
 *   - /api/ai/providers (read-only discovery)
 *
 * All other /api/* routes get `req.user`. Routes opt-in to enforcement via
 * `requireUser(req, reply)` helper — returns 401 if no session.
 *
 * Per audit C1 codebase audit 2026-05-02.
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
	interface FastifyRequest {
		user?: { id: string; email: string };
	}
}

const PUBLIC_ROUTE_PATTERNS = [
	/^\/health(\/.*)?$/,
	/^\/api\/auth\/.*$/,
	/^\/api\/ai\/providers\/?$/,
];

const isPublicRoute = (url: string) => {
	const path = url.split("?")[0] ?? url;
	return PUBLIC_ROUTE_PATTERNS.some((re) => re.test(path));
};

const requireAuthImpl: FastifyPluginAsync = async (app) => {
	app.decorateRequest("user", null as unknown as FastifyRequest["user"]);

	app.addHook("preHandler", async (req) => {
		if (isPublicRoute(req.url)) return;
		if (!app.auth) return; // auth not configured (env missing)

		try {
			const session = await app.auth.api.getSession({
				headers: req.headers as unknown as Headers,
			});
			if (session?.user) {
				req.user = { id: session.user.id, email: session.user.email };
			}
		} catch (err) {
			req.log.debug({ err }, "session lookup failed (anonymous request)");
		}
	});

	app.log.info("Auth middleware ready: req.user populated for /api/*");
};

/**
 * Helper for handlers that require authenticated user.
 * Usage:
 *   handler: async (req, reply) => {
 *     const user = requireUser(req, reply);
 *     if (!user) return; // 401 already sent
 *     // ... use user.id
 *   }
 */
export function requireUser(
	req: FastifyRequest,
	reply: FastifyReply
): { id: string; email: string } | null {
	if (!req.user) {
		reply.code(401).send({ error: "Unauthorized", message: "Authentication required" });
		return null;
	}
	return req.user;
}

export const WORKSPACE_ROLE_RANK = { VIEWER: 0, EDITOR: 1, OWNER: 2 } as const;
export type WorkspaceRole = keyof typeof WORKSPACE_ROLE_RANK;

/**
 * Require systemRole = ADMIN (or MOD if allowMod). Sends 401/403 on failure.
 * Returns null when the request must short-circuit, the user otherwise.
 */
export async function requireAdmin(
	app: { prisma: { user: { findUnique: (args: { where: { id: string }; select: { systemRole: true } }) => Promise<{ systemRole: string } | null> } } },
	req: FastifyRequest,
	reply: FastifyReply,
	opts: { allowMod?: boolean } = {},
): Promise<{ id: string; email: string } | null> {
	const user = requireUser(req, reply);
	if (!user) return null;
	const dbUser = await app.prisma.user.findUnique({
		where: { id: user.id },
		select: { systemRole: true },
	});
	const allowed = dbUser?.systemRole === "ADMIN" || (opts.allowMod && dbUser?.systemRole === "MOD");
	if (!allowed) {
		reply.code(403).send({
			error: opts.allowMod ? "Admin/Mod role required" : "Admin role required",
		});
		return null;
	}
	return user;
}

/**
 * Require caller is workspace member with at least minRole. Returns the member
 * row when authorized, null otherwise (does NOT send a response — caller decides
 * 403 vs custom error shape).
 */
export async function requireWorkspaceMember(
	app: { prisma: { workspaceMember: { findUnique: (args: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => Promise<{ role: string } | null> } } },
	workspaceId: string,
	userId: string,
	minRole: WorkspaceRole = "VIEWER",
): Promise<{ role: string } | null> {
	const member = await app.prisma.workspaceMember.findUnique({
		where: { workspaceId_userId: { workspaceId, userId } },
	});
	if (!member) return null;
	const memberRank = WORKSPACE_ROLE_RANK[member.role as WorkspaceRole] ?? -1;
	if (memberRank < WORKSPACE_ROLE_RANK[minRole]) return null;
	return member;
}

export default fp(requireAuthImpl, { name: "require-auth", dependencies: ["auth"] });
