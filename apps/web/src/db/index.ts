import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { webEnv } from "@/env/web";

// PixStudio split arch: DB + auth + Redis live in apps/api. This module is
// OpenCut leftover and not invoked by any PixStudio code path. Lazy init so
// the build doesn't require DATABASE_URL on apps/web Vercel deployment.
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
	if (!_db) {
		if (!webEnv.DATABASE_URL) {
			throw new Error(
				"DATABASE_URL not set on apps/web — PixStudio routes DB calls via apps/api (Fly.io). " +
					"This OpenCut leftover module should not be invoked.",
			);
		}
		const client = postgres(webEnv.DATABASE_URL);
		_db = drizzle(client, { schema });
	}

	return _db;
}

// Proxy avoids module-load-time DB connection so missing env doesn't break build.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_target, prop) {
		const real = getDb();
		const value = (real as unknown as Record<string | symbol, unknown>)[prop];
		return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
	},
});

export * from "./schema";
