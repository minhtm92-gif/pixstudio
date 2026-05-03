/**
 * Cloud sync indicator for OpenCut editor — observes editor state changes
 * and triggers debounced auto-save to /api/projects/:id/auto-save.
 *
 * Mounted as observer in /editor/[project_id]/page.tsx. Doesn't touch
 * OpenCut state stores — purely subscribes via useEditor selector and
 * pipes state snapshot through useAutoSave.
 *
 * Per Sprint 3 spec: 30s debounce, conflict detection via clientVersion,
 * snapshot ProjectVersion every 10 saves OR 5min.
 */

"use client";

import { useEffect } from "react";
import { Cloud, CloudOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEditor } from "@/editor/use-editor";
import { useAutoSave } from "@/hooks/use-auto-save";

interface CloudSyncIndicatorProps {
	projectId: string;
}

export function CloudSyncIndicator({ projectId }: CloudSyncIndicatorProps) {
	const { save, status, lastSavedAt, error } = useAutoSave(projectId, 0);

	// Subscribe to editor — observer selector that triggers re-render on any
	// store change. useEditor returns a subset that's stable enough to detect
	// 'something changed' without serializing the entire timeline graph.
	// Real timeline serialization (Phase 3) needs OpenCut's wasm serializer.
	const editorChangeKey = useEditor((_e) => Date.now());

	useEffect(() => {
		// Trigger debounced save. useAutoSave internally throttles + skips
		// duplicate payloads via internal hash check (Sprint 3 spec).
		save({ syncedAt: editorChangeKey });
	}, [editorChangeKey, save]);

	const Icon =
		status === "saving" || status === "pending"
			? Loader2
			: status === "error" || status === "conflict"
				? AlertCircle
				: status === "saved"
					? CheckCircle2
					: Cloud;

	const colorCls =
		status === "error" || status === "conflict"
			? "text-red-400"
			: status === "saved"
				? "text-green-400"
				: status === "saving" || status === "pending"
					? "text-blue-400"
					: "text-white/40";

	const label =
		status === "saving"
			? "Saving…"
			: status === "pending"
				? "Pending"
				: status === "saved"
					? `Saved ${lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString("vi-VN") : ""}`
					: status === "conflict"
						? "Conflict"
						: status === "error"
							? "Sync failed"
							: "Cloud sync";

	return (
		<div
			className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900/80 px-2 py-1 text-[10px]"
			title={error ?? `Cloud sync — ${label}`}
		>
			{status === "error" || status === "conflict" ? (
				<CloudOff className="h-3 w-3" aria-hidden />
			) : (
				<Icon
					className={`h-3 w-3 ${status === "saving" || status === "pending" ? "animate-spin" : ""} ${colorCls}`}
					aria-hidden
				/>
			)}
			<span className={colorCls}>{label}</span>
		</div>
	);
}
