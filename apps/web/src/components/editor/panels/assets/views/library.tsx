/**
 * Library tab — SCOPE §3.1 first asset panel.
 *
 * Hosts uploaded media organized by type with horizontal sub-tabs:
 * Media (video/image) / Sounds / Text / Stickers.
 * Preserves OpenCut sub-views accessibly under one SCOPE-aligned tab.
 */

"use client";

import {
	LIBRARY_SUBTABS,
	type LibrarySubTab,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { cn } from "@/utils/ui";
import { MediaView } from "./assets";
import { SoundsView } from "@/sounds/components/assets-view";
import { StickersView } from "@/stickers/components/assets-view";
import { TextView } from "@/text/components/assets-view";

const SUBTAB_LABELS: Record<LibrarySubTab, string> = {
	media: "Media",
	sounds: "Sounds",
	text: "Text",
	stickers: "Stickers",
};

export function LibraryView() {
	const { librarySubTab, setLibrarySubTab } = useAssetsPanelStore();

	return (
		<div className="flex h-full flex-col">
			{/* Sub-tab pills */}
			<div className="flex items-center gap-1 border-b bg-card/50 px-2 py-1.5">
				{LIBRARY_SUBTABS.map((sub) => (
					<button
						key={sub}
						type="button"
						onClick={() => setLibrarySubTab(sub)}
						className={cn(
							"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
							librarySubTab === sub
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{SUBTAB_LABELS[sub]}
					</button>
				))}
			</div>
			{/* Content */}
			<div className="flex-1 overflow-hidden">
				{librarySubTab === "media" && <MediaView />}
				{librarySubTab === "sounds" && <SoundsView />}
				{librarySubTab === "text" && <TextView />}
				{librarySubTab === "stickers" && <StickersView />}
			</div>
		</div>
	);
}
