/**
 * AI gen tab — SCOPE §3.1 third asset panel.
 *
 * Hosts AI-augmented operations under one tab with horizontal sub-tabs:
 * Effects / Transitions / Captions / Adjustment.
 * Preserves OpenCut sub-views accessibly. Future subtabs (Image/Video/Voice
 * gen via DO Inference + Byteplus) will be added in Phase 2.
 */

"use client";

import {
	AIGEN_SUBTABS,
	type AIGenSubTab,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { cn } from "@/utils/ui";
import { Captions } from "@/subtitles/components/assets-view";
import { EffectsView } from "@/effects/components/assets-view";

const SUBTAB_LABELS: Record<AIGenSubTab, string> = {
	effects: "Effects",
	transitions: "Transitions",
	captions: "Captions",
	adjustment: "Adjustment",
};

export function AIGenView() {
	const { aiGenSubTab, setAIGenSubTab } = useAssetsPanelStore();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-1 border-b bg-card/50 px-2 py-1.5">
				{AIGEN_SUBTABS.map((sub) => (
					<button
						key={sub}
						type="button"
						onClick={() => setAIGenSubTab(sub)}
						className={cn(
							"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
							aiGenSubTab === sub
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{SUBTAB_LABELS[sub]}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-hidden">
				{aiGenSubTab === "effects" && <EffectsView />}
				{aiGenSubTab === "transitions" && (
					<div className="p-4 text-sm text-muted-foreground">
						Transitions library — 200+ presets shipping Phase 2 (PW-11).
					</div>
				)}
				{aiGenSubTab === "captions" && <Captions />}
				{aiGenSubTab === "adjustment" && (
					<div className="p-4 text-sm text-muted-foreground">
						Color + scopes adjustment — Phase 3 (PW-12, Pro tier).
					</div>
				)}
			</div>
		</div>
	);
}
