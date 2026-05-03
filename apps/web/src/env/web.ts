import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

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

export const webEnv = webEnvSchema.parse(process.env);
