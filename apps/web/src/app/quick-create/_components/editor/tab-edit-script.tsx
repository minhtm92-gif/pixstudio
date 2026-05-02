/**
 * Tab 2: Edit script (Sprint 4 Story 1.10).
 *
 * Layout per SCOPE.md §13:
 *   - Rows phân cảnh với editable text + Media button + Narrator button
 *   - Narrator: voice picker + speed 1.0x-2.0x adjustable + "Apply to all scenes" checkbox
 *   - Pause "(ngừng)" giữa các sentences
 *   - Apply Changes → regen TTS CHỈ scene đã thay đổi (tiết kiệm ElevenLabs token)
 */

"use client";

import { useState } from "react";
import { Mic, Image as ImageIcon, RefreshCw, Save } from "lucide-react";

interface Scene {
	id: string;
	order: number;
	durationSec: number;
	script: string;
	mediaQuery?: string;
	voiceSettings?: {
		voiceId?: string;
		speed?: number; // 0.5 - 2.0
	};
	scriptChangedSinceTts?: boolean; // true if script edited but TTS not regen yet
}

interface TabEditScriptProps {
	projectId: string;
	editorState: Record<string, unknown> | null;
	onUpdate: (state: Record<string, unknown>) => void;
}

export function TabEditScript({ editorState, onUpdate }: TabEditScriptProps) {
	const scenes =
		((editorState?.["timeline"] as { scenes?: Scene[] })?.scenes ?? []).slice().sort((a, b) => a.order - b.order);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftScripts, setDraftScripts] = useState<Record<string, string>>({});
	const [globalSpeed, setGlobalSpeed] = useState(1.0);
	const [applySpeedToAll, setApplySpeedToAll] = useState(false);

	const updateScene = (sceneId: string, patch: Partial<Scene>) => {
		const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
		const updatedScenes = scenes.map((s) =>
			s.id === sceneId ? { ...s, ...patch, scriptChangedSinceTts: true } : s,
		);
		onUpdate({ ...editorState, timeline: { ...ts, scenes: updatedScenes } });
	};

	const applyDraftScript = (sceneId: string) => {
		const draft = draftScripts[sceneId];
		if (draft !== undefined) {
			updateScene(sceneId, { script: draft });
			setDraftScripts((prev) => {
				const next = { ...prev };
				delete next[sceneId];
				return next;
			});
		}
		setEditingId(null);
	};

	const regenScene = async (sceneId: string) => {
		// TODO Sprint 4 wire to BullMQ job: re-synthesize TTS only this scene
		// POST /api/quick-create/sessions/:id/regen-scene { sceneId }
		console.log("Regen scene", sceneId);
		updateScene(sceneId, { scriptChangedSinceTts: false });
	};

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Global controls */}
			<div className="border-b bg-card px-6 py-3">
				<div className="flex items-center gap-4">
					<label className="flex items-center gap-2 text-sm">
						<Mic className="h-4 w-4" />
						<span>Voice speed:</span>
						<input
							type="range"
							min="0.5"
							max="2.0"
							step="0.05"
							value={globalSpeed}
							onChange={(e) => setGlobalSpeed(Number(e.target.value))}
							className="w-32"
						/>
						<span className="w-10 text-xs text-muted-foreground">{globalSpeed.toFixed(2)}x</span>
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={applySpeedToAll}
							onChange={(e) => setApplySpeedToAll(e.target.checked)}
						/>
						<span>Apply to all scenes</span>
					</label>
					<button className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
						Apply Changes (regen TTS)
					</button>
				</div>
			</div>

			{/* Scene rows */}
			<div className="flex-1 overflow-auto px-6 py-4">
				{scenes.length === 0 ? (
					<div className="text-sm text-muted-foreground">No scenes — go to Edit media tab to add.</div>
				) : (
					<ul className="space-y-3">
						{scenes.map((scene) => (
							<li
								key={scene.id}
								className="rounded-lg border bg-card p-4"
							>
								<div className="mb-2 flex items-center justify-between">
									<div className="text-xs font-semibold uppercase text-muted-foreground">
										Scene {scene.order} · {scene.durationSec.toFixed(1)}s
									</div>
									<div className="flex items-center gap-2">
										{scene.scriptChangedSinceTts && (
											<span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
												TTS pending regen
											</span>
										)}
										<button
											onClick={() => regenScene(scene.id)}
											className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
											title="Regen TTS for this scene only"
										>
											<RefreshCw className="h-4 w-4" />
										</button>
										<button
											className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"
											title="Pick scene media"
										>
											<ImageIcon className="h-3.5 w-3.5" />
											Media
										</button>
										<button
											className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"
											title="Pick narrator voice"
										>
											<Mic className="h-3.5 w-3.5" />
											Narrator
										</button>
									</div>
								</div>
								{editingId === scene.id ? (
									<div className="space-y-2">
										<textarea
											value={draftScripts[scene.id] ?? scene.script}
											onChange={(e) =>
												setDraftScripts((prev) => ({ ...prev, [scene.id]: e.target.value }))
											}
											className="w-full rounded-md border bg-background p-3 text-sm"
											rows={3}
										/>
										<div className="flex gap-2">
											<button
												onClick={() => applyDraftScript(scene.id)}
												className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
											>
												<Save className="h-3 w-3" /> Save
											</button>
											<button
												onClick={() => {
													setDraftScripts((prev) => {
														const next = { ...prev };
														delete next[scene.id];
														return next;
													});
													setEditingId(null);
												}}
												className="rounded-md px-3 py-1.5 text-xs hover:bg-muted"
											>
												Cancel
											</button>
										</div>
									</div>
								) : (
									<div
										onClick={() => setEditingId(scene.id)}
										className="cursor-text rounded-md p-2 text-sm hover:bg-muted/50"
									>
										{scene.script}
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
