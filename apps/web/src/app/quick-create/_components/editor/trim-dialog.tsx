/**
 * TrimDialog modal — Sprint 4 Story 1.12.
 *
 * Per SCOPE.md §13: scene timeline = scene duration. Mỗi clip có drag handle
 * 2 đầu để cắt + drag ⋮⋮ để re-order + ✕ remove. Realtime preview top.
 *
 * Logic:
 *   - Total selected clip duration > scene duration → show trim suggestions
 *   - User cắt từng clip để fit
 *   - Apply → update editor state with trimmed clips
 */

"use client";

import { useState, useEffect } from "react";
import { GripVertical, X, Check, Scissors } from "lucide-react";

interface ClipTrim {
	clipId: string;
	startSec: number;
	endSec: number;
	originalDurationSec: number;
}

interface TrimDialogProps {
	sceneId: string;
	sceneOrder: number;
	sceneDuration: number;
	selectedClipIds: string[];
	onClose: () => void;
	onConfirm: (trimmed: ClipTrim[]) => void;
}

export function TrimDialog({
	sceneId: _sceneId,
	sceneOrder,
	sceneDuration,
	selectedClipIds,
	onClose,
	onConfirm,
}: TrimDialogProps) {
	// Stub clip durations — Sprint 4+: fetch real clip metadata via /api/assets
	const [clips, setClips] = useState<ClipTrim[]>(() =>
		selectedClipIds.map((id) => {
			// Mock: clips ranging 5-20s
			const dur = 5 + Math.random() * 15;
			return {
				clipId: id,
				startSec: 0,
				endSec: dur,
				originalDurationSec: dur,
			};
		}),
	);

	const totalUsedSec = clips.reduce((sum, c) => sum + (c.endSec - c.startSec), 0);
	const fits = Math.abs(totalUsedSec - sceneDuration) < 0.1;
	const overBy = totalUsedSec - sceneDuration;

	// Auto-distribute equal share when first opens (heuristic)
	useEffect(() => {
		const equalShare = sceneDuration / clips.length;
		setClips((prev) =>
			prev.map((c) => ({
				...c,
				endSec: Math.min(c.originalDurationSec, equalShare),
			})),
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const updateClip = (idx: number, patch: Partial<ClipTrim>) => {
		setClips((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
	};

	const removeClip = (idx: number) => {
		setClips((prev) => prev.filter((_, i) => i !== idx));
	};

	const moveClip = (from: number, to: number) => {
		if (to < 0 || to >= clips.length) return;
		const next = [...clips];
		const [moved] = next.splice(from, 1);
		if (moved) next.splice(to, 0, moved);
		setClips(next);
	};

	const autoFit = () => {
		const equalShare = sceneDuration / clips.length;
		setClips((prev) =>
			prev.map((c) => ({
				...c,
				startSec: 0,
				endSec: Math.min(c.originalDurationSec, equalShare),
			})),
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-3xl overflow-hidden rounded-lg bg-card shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
					<div>
						<h2 className="text-lg font-semibold">Trim clips for scene {sceneOrder}</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Scene duration: {sceneDuration.toFixed(1)}s · {clips.length} clip(s)
						</p>
					</div>
					<button
						onClick={onClose}
						className="rounded-md p-1 hover:bg-muted"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Status bar */}
				<div className={`border-b px-6 py-2 text-sm ${fits ? "bg-green-50 text-green-700" : overBy > 0 ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
					{fits ? (
						<>✓ Total {totalUsedSec.toFixed(1)}s fits scene perfectly</>
					) : overBy > 0 ? (
						<>⚠ Total {totalUsedSec.toFixed(1)}s exceeds by {overBy.toFixed(1)}s — trim more</>
					) : (
						<>· Total {totalUsedSec.toFixed(1)}s, {(-overBy).toFixed(1)}s gap remaining</>
					)}
					<button
						onClick={autoFit}
						className="ml-3 rounded bg-card px-2 py-1 text-xs font-medium hover:bg-muted"
					>
						<Scissors className="inline h-3 w-3" /> Auto-fit
					</button>
				</div>

				{/* Realtime preview placeholder */}
				<div className="aspect-video bg-black px-6 py-4">
					<div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
						Realtime preview (Sprint 5: wire compositor)
					</div>
				</div>

				{/* Clip rows */}
				<div className="max-h-80 overflow-auto px-6 py-3">
					<ul className="space-y-2">
						{clips.map((clip, idx) => (
							<li
								key={clip.clipId}
								className="flex items-center gap-3 rounded-md border bg-background p-3"
							>
								<button
									onClick={() => moveClip(idx, idx - 1)}
									disabled={idx === 0}
									className="cursor-grab text-muted-foreground hover:text-foreground disabled:opacity-30"
									title="Move up"
								>
									<GripVertical className="h-4 w-4" />
								</button>
								<div className="flex-1">
									<div className="text-xs font-medium">
										#{idx + 1} · {clip.clipId}
									</div>
									<div className="mt-1 flex items-center gap-2">
										<input
											type="number"
											value={clip.startSec.toFixed(1)}
											step="0.1"
											min="0"
											max={clip.originalDurationSec - 0.1}
											onChange={(e) =>
												updateClip(idx, {
													startSec: Math.max(0, Math.min(clip.endSec - 0.1, Number(e.target.value))),
												})
											}
											className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
										/>
										<span className="text-xs text-muted-foreground">→</span>
										<input
											type="number"
											value={clip.endSec.toFixed(1)}
											step="0.1"
											min={clip.startSec + 0.1}
											max={clip.originalDurationSec}
											onChange={(e) =>
												updateClip(idx, {
													endSec: Math.max(clip.startSec + 0.1, Math.min(clip.originalDurationSec, Number(e.target.value))),
												})
											}
											className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
										/>
										<span className="text-xs text-muted-foreground">
											= {(clip.endSec - clip.startSec).toFixed(1)}s of {clip.originalDurationSec.toFixed(1)}s
										</span>
									</div>
								</div>
								<button
									onClick={() => removeClip(idx)}
									className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
									title="Remove clip"
								>
									<X className="h-4 w-4" />
								</button>
							</li>
						))}
					</ul>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
					<button
						onClick={onClose}
						className="rounded-md px-4 py-2 text-sm hover:bg-muted"
					>
						Cancel
					</button>
					<button
						onClick={() => onConfirm(clips)}
						disabled={clips.length === 0 || (overBy > 0)}
						className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						<Check className="h-4 w-4" />
						Apply trim
					</button>
				</div>
			</div>
		</div>
	);
}
