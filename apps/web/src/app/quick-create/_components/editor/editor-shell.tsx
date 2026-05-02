/**
 * EditorShell — View 6 main layout.
 *
 * 3 tabs (Edit media / Edit script / Edit music) + scene strip top + auto-save status.
 * Per SCOPE.md §13 + acceptance-criteria-draft.md.
 */

"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEditorState } from "../../../../hooks/use-editor-state";
import { useAutoSave } from "../../../../hooks/use-auto-save";
import { TabEditMedia } from "./tab-edit-media";
import { TabEditScript } from "./tab-edit-script";
import { TabEditMusic } from "./tab-edit-music";
import { SceneStrip } from "./scene-strip";

type Tab = "media" | "script" | "music";

interface EditorShellProps {
	projectId: string;
}

export function EditorShell({ projectId }: EditorShellProps) {
	const { data, loading, error } = useEditorState(projectId);
	const [activeTab, setActiveTab] = useState<Tab>("media");
	const [editorState, setEditorState] = useState<Record<string, unknown> | null>(null);
	const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

	const { save, saveNow, status, version, lastSavedAt } = useAutoSave(
		projectId,
		data?.version ?? 0,
	);

	// Hydrate editor state from server on mount
	useEffect(() => {
		if (data?.editorStateJson) {
			setEditorState(data.editorStateJson);
			const scenes =
				(data.editorStateJson["timeline"] as { scenes?: { id: string }[] })
					?.scenes ?? [];
			if (scenes.length > 0 && scenes[0]) {
				setActiveSceneId(scenes[0].id);
			}
		}
	}, [data]);

	// Auto-save on state change
	useEffect(() => {
		if (editorState) save(editorState);
	}, [editorState, save]);

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="rounded-lg bg-destructive/10 p-6 text-destructive">
					<AlertTriangle className="mb-2 h-6 w-6" />
					<p>Failed to load editor: {error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col bg-background">
			{/* Top bar: scene strip + save status */}
			<div className="border-b bg-card px-4 py-2">
				<div className="mb-2 flex items-center justify-between">
					<h1 className="text-lg font-semibold">Editor</h1>
					<SaveStatusBadge
						status={status}
						version={version}
						lastSavedAt={lastSavedAt}
						onSaveNow={() => editorState && saveNow(editorState)}
					/>
				</div>
				<SceneStrip
					editorState={editorState}
					activeSceneId={activeSceneId}
					onSceneSelect={setActiveSceneId}
				/>
			</div>

			{/* Tabs nav */}
			<div className="flex border-b bg-card px-4">
				<TabButton label="Edit media" active={activeTab === "media"} onClick={() => setActiveTab("media")} />
				<TabButton label="Edit script" active={activeTab === "script"} onClick={() => setActiveTab("script")} />
				<TabButton label="Edit music" active={activeTab === "music"} onClick={() => setActiveTab("music")} />
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === "media" && (
					<TabEditMedia
						projectId={projectId}
						editorState={editorState}
						activeSceneId={activeSceneId}
						onUpdate={setEditorState}
					/>
				)}
				{activeTab === "script" && (
					<TabEditScript
						projectId={projectId}
						editorState={editorState}
						onUpdate={setEditorState}
					/>
				)}
				{activeTab === "music" && (
					<TabEditMusic
						projectId={projectId}
						editorState={editorState}
						onUpdate={setEditorState}
					/>
				)}
			</div>
		</div>
	);
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
				active
					? "border-primary text-primary"
					: "border-transparent text-muted-foreground hover:text-foreground"
			}`}
		>
			{label}
		</button>
	);
}

function SaveStatusBadge({
	status,
	version,
	lastSavedAt,
	onSaveNow,
}: {
	status: string;
	version: number;
	lastSavedAt: string | null;
	onSaveNow: () => void;
}) {
	const map: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
		idle: {
			icon: <Save className="h-4 w-4" />,
			text: "All changes saved",
			color: "text-muted-foreground",
		},
		pending: {
			icon: <Loader2 className="h-4 w-4 animate-spin" />,
			text: "Saving...",
			color: "text-muted-foreground",
		},
		saving: {
			icon: <Loader2 className="h-4 w-4 animate-spin" />,
			text: "Saving...",
			color: "text-primary",
		},
		saved: {
			icon: <CheckCircle2 className="h-4 w-4" />,
			text: lastSavedAt
				? `Saved · v${version} · ${new Date(lastSavedAt).toLocaleTimeString("vi-VN")}`
				: `Saved · v${version}`,
			color: "text-green-600",
		},
		error: {
			icon: <AlertTriangle className="h-4 w-4" />,
			text: "Save failed",
			color: "text-destructive",
		},
		conflict: {
			icon: <AlertTriangle className="h-4 w-4" />,
			text: "Conflict — pull latest",
			color: "text-orange-500",
		},
	};
	const entry = map[status] ?? map["idle"]!;

	return (
		<button
			onClick={onSaveNow}
			className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${entry.color} hover:bg-muted`}
			title="Click to save now"
		>
			{entry.icon}
			<span>{entry.text}</span>
		</button>
	);
}
