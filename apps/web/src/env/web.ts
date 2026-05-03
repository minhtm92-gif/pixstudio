import { z } from "zod";

const webEnvSchema = z.object({
	// Node — default so client bundles don't crash when NODE_ENV is undefined
	// or set by Vercel/Edge runtime to a non-standard value at module-eval time.
	NODE_ENV: z.enum(["development", "production", "test"]).catch("production"),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional().catch(undefined),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_API_URL: z.url().optional(),
	NEXT_PUBLIC_MARBLE_API_URL: z.url().optional(),

	// Server — optional in PixStudio split arch (apps/api owns DB + auth + Redis).
	// Modules that touch these (auth/server.ts, db/index.ts, auth/rate-limit.ts)
	// are OpenCut leftover and never invoked at runtime in PixStudio. Keeping
	// them required broke Vercel build because env vars aren't set on web side.
	DATABASE_URL: z
		.string()
		.refine(
			(url) =>
				!url || url.startsWith("postgres://") || url.startsWith("postgresql://"),
			"DATABASE_URL must be a postgres:// or postgresql:// URL when set",
		)
		.optional(),
	BETTER_AUTH_SECRET: z.string().optional(),
	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
	// PixStudio doesn't use these OpenCut-inherited stock library integrations
	MARBLE_WORKSPACE_KEY: z.string().optional(),
	FREESOUND_CLIENT_ID: z.string().optional(),
	FREESOUND_API_KEY: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

// Use safeParse + fallback so a single bad env var doesn't crash the entire
// page (e.g. /login white-screened when NODE_ENV enum failed validation).
const parsed = webEnvSchema.safeParse(process.env);
export const webEnv = parsed.success
	? parsed.data
	: ({
		NODE_ENV: "production" as const,
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	} as WebEnv);

if (!parsed.success && typeof window !== "undefined") {
	// eslint-disable-next-line no-console
	console.warn("[env/web] webEnv validation failed, using safe defaults:", parsed.error.issues);
}
