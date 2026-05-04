/**
 * useAuthUser — single source of truth for sidebar user identity.
 *
 * Fetches better-auth session + first workspace tier + usage in one hook.
 * Replaces hardcoded STUB_USER constants previously scattered across 8 pages
 * which caused identity inconsistency (audit BUG #3).
 */

"use client";

import { useEffect, useState } from "react";
import { apiFetch, type BillingTier, type PixStudioUser } from "@/lib/api-client";

interface SessionResponse {
	user?: { id: string; email: string; name?: string };
}

interface WorkspaceRow {
	id: string;
	name: string;
	billingTier?: BillingTier;
}

interface UsageResponse {
	buildsCount?: number;
}

interface TierLimits {
	buildsPerMonth: number;
}

const TIER_LIMITS: Record<BillingTier, TierLimits> = {
	STANDARD: { buildsPerMonth: 10 },
	PRO: { buildsPerMonth: 50 },
	MAX: { buildsPerMonth: -1 },
};

const STUB_FALLBACK: PixStudioUser = {
	name: "Guest",
	tier: "STANDARD",
	buildsUsed: 0,
	buildsLimit: 10,
};

export function useAuthUser(): {
	user: PixStudioUser;
	loading: boolean;
	signedIn: boolean;
	email: string | null;
	workspaceId: string | null;
} {
	const [user, setUser] = useState<PixStudioUser>(STUB_FALLBACK);
	const [email, setEmail] = useState<string | null>(null);
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [signedIn, setSignedIn] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const session = await apiFetch<SessionResponse>("/api/auth/get-session");
				if (!session.user) {
					if (!cancelled) setLoading(false);
					return;
				}
				if (cancelled) return;
				const displayName =
					session.user.name?.trim() ||
					session.user.email.split("@")[0] ||
					"User";
				setEmail(session.user.email);
				setSignedIn(true);

				let tier: BillingTier = "STANDARD";
				let buildsUsed = 0;
				try {
					const ws = await apiFetch<{ items: WorkspaceRow[] }>("/api/workspaces");
					const firstWs = ws.items[0];
					if (firstWs) {
						setWorkspaceId(firstWs.id);
						if (firstWs.billingTier) tier = firstWs.billingTier;
						try {
							const usage = await apiFetch<UsageResponse>(
								`/api/workspaces/${firstWs.id}/usage`,
							);
							buildsUsed = usage.buildsCount ?? 0;
						} catch {
							/* usage endpoint optional — leave default */
						}
					}
				} catch {
					/* workspaces fetch failed — keep STANDARD default */
				}

				if (cancelled) return;
				setUser({
					name: displayName,
					tier,
					buildsUsed,
					buildsLimit: TIER_LIMITS[tier].buildsPerMonth,
				});
			} catch {
				/* not signed in — keep STUB_FALLBACK */
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return { user, loading, signedIn, email, workspaceId };
}
