/**
 * useEditorState hook — Sprint 3 Story 3.2 cloud sync.
 *
 * Fetches GET /api/projects/:id/editor-state on mount, returns initial state +
 * version. Web client uses this to hydrate Zustand / Yjs store.
 */

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface EditorStateResponse {
	projectId: string;
	editorStateJson: Record<string, unknown> | null;
	version: number;
	lastEditedAt: string;
}

export function useEditorState(projectId: string) {
	const [data, setData] = useState<EditorStateResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const fetchState = async () => {
			setLoading(true);
			try {
				const json = await apiFetch<EditorStateResponse>(
					`/api/projects/${projectId}/editor-state`,
				);
				if (!cancelled) setData(json);
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Unknown error");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void fetchState();
		return () => {
			cancelled = true;
		};
	}, [projectId]);

	return { data, loading, error };
}
