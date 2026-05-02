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

export default fp(requireAuthImpl, { name: "require-auth", dependencies: ["auth"] });
