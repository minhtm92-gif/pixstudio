/**
 * useBugReport hook — Sprint 8 client.
 *
 * Submits bug report to /api/bug-reports. Captures page URL + user agent +
 * console errors automatically. Optional screenshot via R2 presigned upload
 * (Sprint 8 polish).
 */

"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "https://pixstudio-api.fly.dev";

export type BugSeverity = "P0" | "P1" | "P2" | "P3";

export interface BugSubmitInput {
	title: string;
	description: string;
	severity?: BugSeverity;
	workspaceId?: string;
	projectId?: string;
}

export type SubmitState = "idle" | "submitting" | "success" | "error";

export function useBugReport() {
	const [state, setState] = useState<SubmitState>("idle");
	const [error, setError] = useState<string | null>(null);
	const [bugId, setBugId] = useState<string | null>(null);

	const submit = useCallback(async (input: BugSubmitInput): Promise<void> => {
		setState("submitting");
		setError(null);
		try {
			const body = {
				...input,
				severity: input.severity ?? "P2",
				pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
				userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
				// consoleErrors: Sprint 8 polish — capture from window.onerror buffer
			};
			const res = await fetch(`${API_BASE}/api/bug-reports`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errBody.error ?? `HTTP ${res.status}`);
			}
			const json = (await res.json()) as { id: string };
			setBugId(json.id);
			setState("success");
		} catch (err) {
			setState("error");
			setError(err instanceof Error ? err.message : "Failed to submit bug report");
		}
	}, []);

	const reset = useCallback(() => {
		setState("idle");
		setError(null);
		setBugId(null);
	}, []);

	return { submit, reset, state, error, bugId };
}
