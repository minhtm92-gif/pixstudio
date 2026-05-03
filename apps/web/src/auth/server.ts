import { betterAuth, type RateLimit } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Redis } from "@upstash/redis";
import { db } from "@/db";
import { webEnv } from "@/env/web";

// PixStudio split arch: auth flows go through apps/api (Fly.io) Better-auth
// instance. This module is OpenCut leftover, kept for the OpenCut
// /api/auth/[...all] route handler. Build must not fail when env vars are
// missing on apps/web — guards added accordingly.
let _auth: ReturnType<typeof betterAuth> | null = null;

function buildAuth() {
	if (!webEnv.UPSTASH_REDIS_REST_URL || !webEnv.UPSTASH_REDIS_REST_TOKEN) {
		throw new Error(
			"Upstash Redis env not set on apps/web — PixStudio uses apps/api auth. " +
				"This OpenCut leftover module should not be invoked.",
		);
	}
	if (!webEnv.BETTER_AUTH_SECRET) {
		throw new Error("BETTER_AUTH_SECRET not set on apps/web — PixStudio uses apps/api auth.");
	}
	const redis = new Redis({
		url: webEnv.UPSTASH_REDIS_REST_URL,
		token: webEnv.UPSTASH_REDIS_REST_TOKEN,
	});
	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
		secret: webEnv.BETTER_AUTH_SECRET,
		user: { deleteUser: { enabled: true } },
		emailAndPassword: { enabled: true },
		rateLimit: {
			storage: "secondary-storage",
			customStorage: {
				get: async (key) => {
					const value = await redis.get(key);
					return value as RateLimit | undefined;
				},
				set: async (key, value) => {
					await redis.set(key, value);
				},
			},
		},
		baseURL: webEnv.NEXT_PUBLIC_SITE_URL,
		appName: "PixStudio",
		trustedOrigins: [webEnv.NEXT_PUBLIC_SITE_URL],
	});
}

// Lazy proxy — same shape as direct export but defers initialization.
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
	get(_target, prop) {
		if (!_auth) _auth = buildAuth();
		const value = (_auth as unknown as Record<string | symbol, unknown>)[prop];
		return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(_auth) : value;
	},
});

export type Auth = ReturnType<typeof betterAuth>;
