import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { webEnv } from "@/env/web";

// PixStudio split arch: rate limiting handled by apps/api Fastify rateLimit
// plugin. This module is OpenCut leftover. Build must not fail when env
// vars are missing on apps/web side.
let _ratelimit: Ratelimit | null = null;

function getRateLimit(): Ratelimit {
	if (_ratelimit) return _ratelimit;
	if (!webEnv.UPSTASH_REDIS_REST_URL || !webEnv.UPSTASH_REDIS_REST_TOKEN) {
		throw new Error(
			"Upstash Redis env not set on apps/web — PixStudio uses apps/api rate limit. " +
				"This OpenCut leftover module should not be invoked.",
		);
	}
	const redis = new Redis({
		url: webEnv.UPSTASH_REDIS_REST_URL,
		token: webEnv.UPSTASH_REDIS_REST_TOKEN,
	});
	_ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(100, "1 m"),
		analytics: true,
		prefix: "rate-limit",
	});
	return _ratelimit;
}

export const baseRateLimit = new Proxy({} as Ratelimit, {
	get(_target, prop) {
		const real = getRateLimit();
		const value = (real as unknown as Record<string | symbol, unknown>)[prop];
		return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
	},
});

export async function checkRateLimit({ request }: { request: Request }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = await getRateLimit().limit(ip);
	return { success, limited: !success };
}
