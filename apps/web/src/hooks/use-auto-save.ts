/**
 * useAutoSave hook — Sprint 3 Story 3.3 client-side wire.
 *
 * Debounces editor state changes 30s, POSTs to /api/projects/:id/auto-save.
 * Tracks server version for conflict detection.
 *
 * Usage:
 *   const { save, status, version } = useAutoSave(projectId, initialVersion);
 *   useEffect(() => { save(editorState); }, [editorState]);
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_SAVE_DEBOUNCE_MS = 30_000; // 30s per Sprint 3 spec
const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "https://pixstudio-api.fly.dev";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

interface AutoSaveResponse {
	version: number;
	savedAt: string;
	snapshotCreated: boolean;
}

export function useAutoSave(projectId: string, initialVersion: number = 0) {
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [version, setVersion] = useState(initialVersion);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingStateRef = useRef<Record<string, unknown> | null>(null);
	const versionRef = useRef(initialVersion);

	useEffect(() => {
		versionRef.current = version;
	}, [version]);

	const performSave = useCallback(async (state: Record<string, unknown>) => {
		setStatus("saving");
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/api/projects/${projectId}/auto-save`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					editorStateJson: state,
					clientVersion: versionRef.current,
				}),
			});
			if (res.status === 409) {
				const json = (await res.json()) as { serverVersion: number };
				setStatus("conflict");
				setError(`Stale state — server is at version ${json.serverVersion}. Pull latest first.`);
				return;
			}
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errBody.error ?? `HTTP ${res.status}`);
			}
			const json = (await res.json()) as AutoSaveResponse;
			setVersion(json.version);
			setLastSavedAt(json.savedAt);
			setStatus("saved");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Unknown error");
		}
	}, [projectId]);

	const save = useCallback((state: Record<string, unknown>) => {
		pendingStateRef.current = state;
		setStatus("pending");
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		debounceTimerRef.current = setTimeout(() => {
			if (pendingStateRef.current) {
				void performSave(pendingStateRef.current);
				pendingStateRef.current = null;
			}
		}, AUTO_SAVE_DEBOUNCE_MS);
	}, [performSave]);

	const saveNow = useCallback(async (state?: Record<string, unknown>) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		const toSave = state ?? pendingStateRef.current;
		if (toSave) {
			pendingStateRef.current = null;
			await performSave(toSave);
		}
	}, [performSave]);

	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		};
	}, []);

	return {
		save,
		saveNow,
		status,
		version,
		lastSavedAt,
		error,
	};
}
