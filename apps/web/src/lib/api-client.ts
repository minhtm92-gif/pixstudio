/**
 * Shared API client for cookie-credentialed PixStudio endpoints.
 *
 * Use this for routes that rely on better-auth session cookies (admin pages,
 * KPI dashboard, brand-kit, projects auto-save). For Quick Create which uses
 * bearer tokens, see `quick-create-api.ts`.
 */

export const API_BASE =
	process.env["NEXT_PUBLIC_API_URL"] ?? "https://pixstudio-api.fly.dev";

/**
 * Fetch wrapper that injects credentials: "include" + sets JSON Content-Type
 * when a body is present. Returns parsed JSON; throws on non-OK responses.
 */
export async function apiFetch<T = unknown>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers,
		credentials: "include",
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as {
			error?: string;
			message?: string;
		};
		throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
	}
	return (await res.json()) as T;
}

// ─── Shared types ──────────────────────────────────────────────────────

export type BillingTier = "STANDARD" | "PRO" | "MAX";

export interface PixStudioUser {
	name: string;
	tier: BillingTier;
	buildsUsed: number;
	/** -1 = unlimited (MAX tier). */
	buildsLimit: number;
}
