/**
 * SceneStrip — top horizontal scene timeline.
 *
 * Per SCOPE.md §13: shows all scenes as thumbnails / cards, click to select.
 * Active scene highlighted. User can reorder via drag (Sprint 4 Story 1.12 wires Trim Dialog).
 */

"use client";

import { Film } from "lucide-react";

interface Scene {
	id: string;
	order: number;
	durationSec: number;
	script: string;
	mediaQuery?: string;
}

interface SceneStripProps {
	editorState: Record<string, unknown> | null;
	activeSceneId: string | null;
	onSceneSelect: (id: string) => void;
}

export function SceneStrip({ editorState, activeSceneId, onSceneSelect }: SceneStripProps) {
	const scenes =
		((editorState?.["timeline"] as { scenes?: Scene[] })?.scenes ?? []).slice().sort((a, b) => a.order - b.order);

	if (scenes.length === 0) {
		return (
			<div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
				<Film className="h-3 w-3" />
				No scenes yet
			</div>
		);
	}

	return (
		<div className="flex gap-2 overflow-x-auto py-2">
			{scenes.map((scene) => (
				<button
					key={scene.id}
					onClick={() => onSceneSelect(scene.id)}
					className={`flex shrink-0 flex-col gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
						activeSceneId === scene.id
							? "border-primary bg-primary/10 text-primary"
							: "border-border bg-muted hover:border-primary/50"
					}`}
				>
					<div className="font-medium">Scene {scene.order}</div>
					<div className="text-muted-foreground">{scene.durationSec.toFixed(1)}s</div>
					<div className="line-clamp-1 max-w-[120px] text-foreground/70">
						{scene.script}
					</div>
				</button>
			))}
		</div>
	);
}
