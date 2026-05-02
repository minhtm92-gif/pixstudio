/**
 * Tab 1: Edit media (Sprint 4 Story 1.9).
 *
 * Layout per SCOPE.md §13:
 *   - Top: scene strip (rendered in EditorShell parent)
 *   - Middle: script display with active scene highlighted
 *   - Bottom: media browser (Upload tab + iStock + Shutter + Envato search)
 *
 * Multi-select clips → Replace → trigger Trim Dialog if total > scene duration.
 */

"use client";

import { useState } from "react";
import { Upload, Search, Sparkles, ImageIcon } from "lucide-react";
import { TrimDialog } from "./trim-dialog";

type MediaSource = "upload" | "istock" | "shutter" | "envato" | "ai-gen";

interface TabEditMediaProps {
	projectId: string;
	editorState: Record<string, unknown> | null;
	activeSceneId: string | null;
	onUpdate: (state: Record<string, unknown>) => void;
}

export function TabEditMedia({ editorState, activeSceneId, onUpdate }: TabEditMediaProps) {
	const [selectedSource, setSelectedSource] = useState<MediaSource>("upload");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedClips, setSelectedClips] = useState<string[]>([]);
	const [trimDialogOpen, setTrimDialogOpen] = useState(false);

	const scenes =
		((editorState?.["timeline"] as { scenes?: { id: string; order: number; script: string; durationSec: number }[] })?.scenes ?? []);
	const activeScene = scenes.find((s) => s.id === activeSceneId);

	return (
		<div className="flex h-full flex-col">
			{/* Script display: active scene + dim others */}
			<div className="border-b bg-muted/30 px-6 py-4">
				<div className="text-xs font-medium uppercase text-muted-foreground">
					Active Scene {activeScene?.order ?? "?"} · {activeScene?.durationSec.toFixed(1) ?? "?"}s
				</div>
				<div className="mt-2 text-base">{activeScene?.script ?? "Select a scene above"}</div>
			</div>

			{/* Media browser */}
			<div className="flex-1 overflow-hidden">
				<div className="flex border-b bg-card">
					<MediaSourceTab label="Upload" icon={<Upload className="h-3.5 w-3.5" />} active={selectedSource === "upload"} onClick={() => setSelectedSource("upload")} />
					<MediaSourceTab label="iStock 👑" icon={<ImageIcon className="h-3.5 w-3.5" />} active={selectedSource === "istock"} onClick={() => setSelectedSource("istock")} />
					<MediaSourceTab label="Shutterstock 👑" icon={<ImageIcon className="h-3.5 w-3.5" />} active={selectedSource === "shutter"} onClick={() => setSelectedSource("shutter")} />
					<MediaSourceTab label="Envato 👑" icon={<ImageIcon className="h-3.5 w-3.5" />} active={selectedSource === "envato"} onClick={() => setSelectedSource("envato")} />
					<MediaSourceTab label="AI Generate ✨" icon={<Sparkles className="h-3.5 w-3.5" />} active={selectedSource === "ai-gen"} onClick={() => setSelectedSource("ai-gen")} />
				</div>

				<div className="px-6 py-4">
					<div className="mb-4 flex items-center gap-2">
						<Search className="h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={`Search ${selectedSource}...`}
							className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
						/>
					</div>

					{/* Clip grid placeholder */}
					<div className="grid grid-cols-4 gap-3">
						{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
							<div
								key={i}
								onClick={() => {
									const clipId = `${selectedSource}-clip-${i}`;
									setSelectedClips((prev) =>
										prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId],
									);
								}}
								className={`aspect-video cursor-pointer overflow-hidden rounded-md border text-xs ${
									selectedClips.includes(`${selectedSource}-clip-${i}`)
										? "border-primary bg-primary/10"
										: "border-border bg-muted hover:border-primary/50"
								}`}
							>
								<div className="flex h-full items-center justify-center text-muted-foreground">
									Clip {i}
								</div>
							</div>
						))}
					</div>

					{/* Replace action */}
					{selectedClips.length > 0 && activeScene && (
						<div className="mt-4 flex items-center justify-between rounded-md bg-card p-3">
							<div className="text-sm">
								<strong>{selectedClips.length}</strong> clip(s) selected
							</div>
							<button
								onClick={() => setTrimDialogOpen(true)}
								className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
							>
								Replace scene {activeScene.order} media
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Trim Dialog modal */}
			{trimDialogOpen && activeScene && (
				<TrimDialog
					sceneId={activeScene.id}
					sceneOrder={activeScene.order}
					sceneDuration={activeScene.durationSec}
					selectedClipIds={selectedClips}
					onClose={() => setTrimDialogOpen(false)}
					onConfirm={(trimmedClips) => {
						// Apply to editor state
						const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
						const updatedScenes = scenes.map((s) =>
							s.id === activeScene.id
								? {
										...s,
										mediaClips: trimmedClips,
									}
								: s,
						);
						onUpdate({
							...editorState,
							timeline: { ...ts, scenes: updatedScenes },
						});
						setSelectedClips([]);
						setTrimDialogOpen(false);
					}}
				/>
			)}
		</div>
	);
}

function MediaSourceTab({
	label,
	icon,
	active,
	onClick,
}: {
	label: string;
	icon: React.ReactNode;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
				active
					? "border-primary text-primary"
					: "border-transparent text-muted-foreground hover:text-foreground"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}
