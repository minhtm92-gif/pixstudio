/**
 * useBugReport hook — Sprint 8 client.
 *
 * Submits bug report to /api/bug-reports. Captures page URL + user agent +
 * console errors automatically. Optional screenshot via R2 presigned upload
 * (Sprint 8 polish).
 */

"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

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
			};
			const json = await apiFetch<{ id: string }>("/api/bug-reports", {
				method: "POST",
				body: JSON.stringify(body),
			});
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
