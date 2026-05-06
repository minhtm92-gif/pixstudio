/**
 * Tab 2: Edit script (per SCOPE §13).
 *
 * Layout:
 *   - Rows phân cảnh với editable text + Media button + Narrator button
 *   - Narrator: voice picker + speed 1.0x-2.0x adjustable + "Apply to all scenes" checkbox
 *   - Pause "(ngừng)" inserted between sentences (TTS SSML hint)
 *   - Apply Changes → regen TTS CHỈ scene đã thay đổi (tiết kiệm ElevenLabs token)
 */

"use client";

import { useState } from "react";
import {
	Mic,
	Image as ImageIcon,
	Languages,
	RefreshCw,
	Save,
	Loader2,
	AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { VoicePickerDialog } from "./voice-picker-dialog";

interface Scene {
	id: string;
	order: number;
	durationSec: number;
	script: string;
	mediaQuery?: string;
	voiceSettings?: {
		voiceId?: string;
		voiceName?: string;
		speed?: number;
	};
	scriptChangedSinceTts?: boolean;
}

interface TabEditScriptProps {
	projectId: string;
	editorState: Record<string, unknown> | null;
	onUpdate: (state: Record<string, unknown>) => void;
}

/**
 * Insert "(ngừng)" between sentences for TTS pause hints.
 * Detects sentence boundaries on `.`, `?`, `!` followed by space + uppercase.
 */
function insertSentencePauses(text: string): string {
	if (!text) return text;
	if (text.includes("(ngừng)")) return text; // idempotent
	return text.replace(/([.!?])\s+(?=[A-ZÀ-ỹ])/g, "$1 (ngừng) ");
}

export function TabEditScript({ projectId, editorState, onUpdate }: TabEditScriptProps) {
	const scenes =
		((editorState?.["timeline"] as { scenes?: Scene[] })?.scenes ?? [])
			.slice()
			.sort((a, b) => a.order - b.order);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftScripts, setDraftScripts] = useState<Record<string, string>>({});
	const [globalSpeed, setGlobalSpeed] = useState(1.0);
	const [applySpeedToAll, setApplySpeedToAll] = useState(false);
	const [regenBusy, setRegenBusy] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [voicePickerSceneId, setVoicePickerSceneId] = useState<string | null>(null);
	const [pausesEnabled, setPausesEnabled] = useState(true);
	const [translateBusy, setTranslateBusy] = useState(false);
	const [voiceOverBusy, setVoiceOverBusy] = useState(false);

	const updateScene = (sceneId: string, patch: Partial<Scene>) => {
		const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
		const updatedScenes = scenes.map((s) =>
			s.id === sceneId ? { ...s, ...patch, scriptChangedSinceTts: true } : s,
		);
		onUpdate({ ...editorState, timeline: { ...ts, scenes: updatedScenes } });
	};

	const updateAllScenesSpeed = (speed: number) => {
		const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
		const updatedScenes = scenes.map((s) => ({
			...s,
			voiceSettings: { ...(s.voiceSettings ?? {}), speed },
			scriptChangedSinceTts: true,
		}));
		onUpdate({ ...editorState, timeline: { ...ts, scenes: updatedScenes } });
	};

	const applyDraftScript = (sceneId: string) => {
		const draft = draftScripts[sceneId];
		if (draft !== undefined) {
			const text = pausesEnabled ? insertSentencePauses(draft) : draft;
			updateScene(sceneId, { script: text });
			setDraftScripts((prev) => {
				const next = { ...prev };
				delete next[sceneId];
				return next;
			});
		}
		setEditingId(null);
	};

	const regenScene = async (sceneId: string) => {
		setError(null);
		setRegenBusy((s) => new Set(s).add(sceneId));
		try {
			await apiFetch(`/api/projects/${projectId}/regen-scene`, {
				method: "POST",
				body: JSON.stringify({ sceneId }),
			});
			updateScene(sceneId, { scriptChangedSinceTts: false });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Regen failed");
		} finally {
			setRegenBusy((s) => {
				const next = new Set(s);
				next.delete(sceneId);
				return next;
			});
		}
	};

	const regenAllChanged = async () => {
		setError(null);
		const changed = scenes.filter((s) => s.scriptChangedSinceTts);
		if (changed.length === 0) return;
		try {
			await apiFetch(`/api/projects/${projectId}/regen-scene`, {
				method: "POST",
				body: JSON.stringify({ sceneIds: changed.map((s) => s.id) }),
			});
			const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
			const updatedScenes = scenes.map((s) =>
				s.scriptChangedSinceTts ? { ...s, scriptChangedSinceTts: false } : s,
			);
			onUpdate({ ...editorState, timeline: { ...ts, scenes: updatedScenes } });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Regen all failed");
		}
	};

	const applySpeedClicked = (newSpeed: number) => {
		setGlobalSpeed(newSpeed);
		if (applySpeedToAll) updateAllScenesSpeed(newSpeed);
	};

	const handleVoicePicked = (voice: { voiceId: string; name: string }) => {
		if (!voicePickerSceneId) return;
		updateScene(voicePickerSceneId, {
			voiceSettings: {
				...(scenes.find((s) => s.id === voicePickerSceneId)?.voiceSettings ?? {}),
				voiceId: voice.voiceId,
				voiceName: voice.name,
				speed: globalSpeed,
			},
		});
		setVoicePickerSceneId(null);
	};

	const handleTranslate = async (targetLang: "vi" | "en") => {
		setError(null);
		if (scenes.length === 0) return;
		const sourceLang = targetLang === "vi" ? "en" : "vi";
		setTranslateBusy(true);
		try {
			const payload = scenes.map((s) => ({
				startSec: 0,
				durationSec: s.durationSec,
				text: s.script,
			}));
			const res = await apiFetch<{
				segments: Array<{ text: string }>;
			}>("/api/captions/translate", {
				method: "POST",
				body: JSON.stringify({ segments: payload, sourceLang, targetLang }),
				// 52-segment LLM batch may take ~30-60s on DO Inference; default 30s
				// timeout aborts mid-flight. Allow 2 min.
				timeoutMs: 120_000,
			} as RequestInit & { timeoutMs?: number });
			const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
			const updatedScenes = scenes.map((s, i) => ({
				...s,
				script: res.segments[i]?.text ?? s.script,
				scriptChangedSinceTts: true,
			}));
			onUpdate({ ...editorState, timeline: { ...ts, scenes: updatedScenes } });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Translate failed");
		} finally {
			setTranslateBusy(false);
		}
	};

	const handleVoiceOver = async () => {
		setError(null);
		if (scenes.length === 0) return;
		setVoiceOverBusy(true);
		try {
			const payload = scenes.map((s) => ({ text: s.script }));
			const res = await apiFetch<{
				signedUrl: string;
				r2Key: string;
				costUsd: number;
			}>("/api/captions/voice-over", {
				method: "POST",
				body: JSON.stringify({ segments: payload, languageCode: "vi" }),
				// Concatenated TTS for full script can take 60-120s on ElevenLabs
				// for ~10K char input. Default 30s aborts mid-flight.
				timeoutMs: 180_000,
			} as RequestInit & { timeoutMs?: number });
			const ts = (editorState?.["timeline"] as Record<string, unknown>) ?? {};
			onUpdate({
				...editorState,
				voiceOverR2Key: res.r2Key,
				voiceOverSignedUrl: res.signedUrl,
				timeline: { ...ts },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Voice-over failed");
		} finally {
			setVoiceOverBusy(false);
		}
	};

	const totalChanged = scenes.filter((s) => s.scriptChangedSinceTts).length;

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Global controls */}
			<div className="border-b bg-card px-6 py-3">
				<div className="flex flex-wrap items-center gap-4">
					<label className="flex items-center gap-2 text-sm">
						<Mic className="h-4 w-4" />
						<span>Voice speed:</span>
						<input
							type="range"
							min="0.5"
							max="2.0"
							step="0.05"
							value={globalSpeed}
							onChange={(e) => applySpeedClicked(Number(e.target.value))}
							className="w-32"
						/>
						<span className="w-10 text-xs text-muted-foreground">
							{globalSpeed.toFixed(2)}x
						</span>
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={applySpeedToAll}
							onChange={(e) => {
								setApplySpeedToAll(e.target.checked);
								if (e.target.checked) updateAllScenesSpeed(globalSpeed);
							}}
						/>
						<span>Apply to all scenes</span>
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={pausesEnabled}
							onChange={(e) => setPausesEnabled(e.target.checked)}
						/>
						<span>Auto pause "(ngừng)"</span>
					</label>
					<div className="ml-auto flex items-center gap-2">
						<button
							type="button"
							onClick={() => void handleTranslate("en")}
							disabled={translateBusy || scenes.length === 0}
							className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
							title="Dịch toàn bộ script sang English (DO Inference)"
						>
							{translateBusy ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Languages className="h-3.5 w-3.5" />
							)}
							Translate → EN
						</button>
						<button
							type="button"
							onClick={() => void handleTranslate("vi")}
							disabled={translateBusy || scenes.length === 0}
							className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
							title="Dịch toàn bộ script sang Vietnamese (DO Inference)"
						>
							{translateBusy ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Languages className="h-3.5 w-3.5" />
							)}
							Translate → VI
						</button>
						<button
							type="button"
							onClick={() => void handleVoiceOver()}
							disabled={voiceOverBusy || scenes.length === 0}
							className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
							title="Re-voice toàn bộ script qua ElevenLabs Multilingual v2"
						>
							{voiceOverBusy ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Mic className="h-3.5 w-3.5" />
							)}
							Voice over
						</button>
						<button
							type="button"
							onClick={() => void regenAllChanged()}
							disabled={totalChanged === 0}
							className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
						>
							Apply Changes (regen TTS · {totalChanged} scene
							{totalChanged === 1 ? "" : "s"})
						</button>
					</div>
				</div>
				{error && (
					<div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
						<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>{error}</span>
					</div>
				)}
			</div>

			{/* Scene rows */}
			<div className="flex-1 overflow-auto px-6 py-4">
				{scenes.length === 0 ? (
					<div className="text-sm text-muted-foreground">
						No scenes — go to Edit media tab to add.
					</div>
				) : (
					<ul className="space-y-3">
						{scenes.map((scene) => {
							const busy = regenBusy.has(scene.id);
							return (
								<li key={scene.id} className="rounded-lg border bg-card p-4">
									<div className="mb-2 flex items-center justify-between">
										<div className="text-xs font-semibold uppercase text-muted-foreground">
											Scene {scene.order} · {scene.durationSec.toFixed(1)}s
											{scene.voiceSettings?.voiceName && (
												<span className="ml-2 normal-case text-foreground/70">
													· {scene.voiceSettings.voiceName}
												</span>
											)}
										</div>
										<div className="flex items-center gap-2">
											{scene.scriptChangedSinceTts && (
												<span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
													TTS pending regen
												</span>
											)}
											<button
												type="button"
												onClick={() => void regenScene(scene.id)}
												disabled={busy}
												className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
												title="Regen TTS for this scene only"
											>
												{busy ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<RefreshCw className="h-4 w-4" />
												)}
											</button>
											<button
												type="button"
												className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"
												title="Pick scene media"
											>
												<ImageIcon className="h-3.5 w-3.5" />
												Media
											</button>
											<button
												type="button"
												onClick={() => setVoicePickerSceneId(scene.id)}
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
													setDraftScripts((prev) => ({
														...prev,
														[scene.id]: e.target.value,
													}))
												}
												className="w-full rounded-md border bg-background p-3 text-sm"
												rows={3}
											/>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => applyDraftScript(scene.id)}
													className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
												>
													<Save className="h-3 w-3" /> Save
												</button>
												<button
													type="button"
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
							);
						})}
					</ul>
				)}
			</div>

			<VoicePickerDialog
				open={voicePickerSceneId !== null}
				onOpenChange={(open) => {
					if (!open) setVoicePickerSceneId(null);
				}}
				currentVoiceId={
					voicePickerSceneId
						? scenes.find((s) => s.id === voicePickerSceneId)?.voiceSettings?.voiceId
						: undefined
				}
				onSelect={handleVoicePicked}
			/>
		</div>
	);
}
