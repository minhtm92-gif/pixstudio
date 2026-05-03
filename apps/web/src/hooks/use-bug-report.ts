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
	/** Optional File from <input type="file" accept="image/*"> */
	screenshot?: File;
}

interface PresignResponse {
	presignedUrl: string;
	r2Key: string;
}

/**
 * Upload screenshot to R2 via presigned PUT URL.
 * Reuses the brand-kit logo presign endpoint pattern.
 */
async function uploadScreenshot(file: File): Promise<string | null> {
	if (file.size > 2 * 1024 * 1024) {
		throw new Error("Screenshot quá lớn (max 2MB)");
	}
	if (!file.type.startsWith("image/")) {
		throw new Error("File phải là image (PNG/JPEG/WebP)");
	}
	try {
		const presign = await apiFetch<PresignResponse>("/api/bug-reports/screenshot-presign", {
			method: "POST",
			body: JSON.stringify({
				mimeType: file.type,
				sizeBytes: file.size,
			}),
		});
		const putRes = await fetch(presign.presignedUrl, {
			method: "PUT",
			body: file,
			headers: { "Content-Type": file.type },
		});
		if (!putRes.ok) {
			throw new Error(`R2 upload failed: HTTP ${putRes.status}`);
		}
		return presign.r2Key;
	} catch (err) {
		console.warn("[useBugReport] screenshot upload failed", err);
		return null;
	}
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
			let screenshotR2Key: string | null = null;
			if (input.screenshot) {
				screenshotR2Key = await uploadScreenshot(input.screenshot);
			}
			const { screenshot: _unused, ...rest } = input;
			void _unused;
			const body = {
				...rest,
				severity: input.severity ?? "P2",
				pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
				userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
				...(screenshotR2Key ? { screenshotR2Key } : {}),
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
