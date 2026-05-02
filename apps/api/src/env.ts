/**
 * apps/api environment validation — fail-fast on missing config.
 *
 * Per audit M8 (codebase audit 2026-05-02). Mirrors apps/web pattern with
 * `webEnv = webEnvSchema.parse(process.env)`.
 */

import { z } from "zod";

const apiEnvSchema = z.object({
	// Node + server
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(8080),
	HOST: z.string().default("0.0.0.0"),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
	CORS_ORIGINS: z.string().optional(),

	// Database
	DATABASE_URL: z
		.string()
		.refine(
			(url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
			"DATABASE_URL must be postgres:// or postgresql://"
		),

	// Auth
	BETTER_AUTH_SECRET: z.string().min(32).optional(),
	NEXTAUTH_SECRET: z.string().min(32).optional(),
	AUTH_BASE_URL: z.string().url().optional(),

	// Redis (Upstash)
	UPSTASH_REDIS_REST_URL: z.string().url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

	// R2 storage
	R2_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_ENDPOINT_URL: z.string().url().optional(),
	R2_BUCKET_UPLOADS: z.string().default("pxs-vn-sg-uploads"),
	R2_BUCKET_RENDERS: z.string().default("pxs-vn-sg-renders"),
	R2_BUCKET_DERIVED: z.string().default("pxs-vn-sg-derived"),

	// AI providers (each optional — registry skips missing)
	DO_INFERENCE_TOKEN: z.string().optional(),
	DO_API_TOKEN: z.string().optional(),
	GEMINI_API_KEY: z.string().optional(),
	BYTEPLUS_ACCESS_KEY: z.string().optional(),
	BYTEPLUS_SECRET_KEY: z.string().optional(),
	ELEVENLABS_API_KEY: z.string().optional(),
	FAL_API_KEY: z.string().optional(),
	DEEPGRAM_API_KEY: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

const result = apiEnvSchema.safeParse(process.env);
if (!result.success) {
	console.error("✗ apps/api env validation failed:");
	for (const issue of result.error.issues) {
		console.error(`  ${issue.path.join(".")}: ${issue.message}`);
	}
	throw new Error("Invalid environment configuration");
}

export const apiEnv: ApiEnv = result.data;

/** Effective auth secret — backward compat with NEXTAUTH_SECRET fallback. */
export const authSecret = apiEnv.BETTER_AUTH_SECRET ?? apiEnv.NEXTAUTH_SECRET;
