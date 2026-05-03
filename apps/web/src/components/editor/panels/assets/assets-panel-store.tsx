import type { ElementType } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	ColorsIcon,
	Folder03Icon,
	MagicWand05Icon,
	NoteIcon,
	StoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

// SCOPE §3.1 mandates 5 tabs: Library / Stock / AI gen / Templates / Brand kit.
// OpenCut native sub-categories (Media/Sounds/Text/Stickers/Effects/Transitions/
// Captions/Adjustment/Settings) are surfaced as inner sub-tabs within Library
// + AI gen + Brand kit (Settings).
export const TAB_KEYS = [
	"library",
	"stock",
	"aiGen",
	"templates",
	"brandKit",
] as const;

export type Tab = (typeof TAB_KEYS)[number];

// Library inner sub-tabs (preserve OpenCut media/sounds/text/stickers).
export const LIBRARY_SUBTABS = ["media", "sounds", "text", "stickers"] as const;
export type LibrarySubTab = (typeof LIBRARY_SUBTABS)[number];

// AI gen inner sub-tabs (OpenCut effects/transitions/captions/adjustment +
// new image/video/voice gen entry points to magic tools / Quick Create).
export const AIGEN_SUBTABS = [
	"effects",
	"transitions",
	"captions",
	"adjustment",
] as const;
export type AIGenSubTab = (typeof AIGEN_SUBTABS)[number];

const createHugeiconsIcon =
	({ icon }: { icon: IconSvgElement }) =>
	({ className }: { className?: string }) => (
		<HugeiconsIcon icon={icon} className={className} />
	);

export const tabs = {
	library: {
		icon: createHugeiconsIcon({ icon: Folder03Icon }),
		label: "Library",
	},
	stock: {
		icon: createHugeiconsIcon({ icon: StoreIcon }),
		label: "Stock",
	},
	aiGen: {
		icon: createHugeiconsIcon({ icon: MagicWand05Icon }),
		label: "AI gen",
	},
	templates: {
		icon: createHugeiconsIcon({ icon: NoteIcon }),
		label: "Templates",
	},
	brandKit: {
		icon: createHugeiconsIcon({ icon: ColorsIcon }),
		label: "Brand kit",
	},
} satisfies Record<
	Tab,
	{ icon: ElementType<{ className?: string }>; label: string }
>;

export type MediaViewMode = "grid" | "list";
export type MediaSortKey = "name" | "type" | "duration" | "size";
export type MediaSortOrder = "asc" | "desc";

interface AssetsPanelStore {
	activeTab: Tab;
	setActiveTab: (tab: Tab) => void;
	librarySubTab: LibrarySubTab;
	setLibrarySubTab: (sub: LibrarySubTab) => void;
	aiGenSubTab: AIGenSubTab;
	setAIGenSubTab: (sub: AIGenSubTab) => void;
	highlightMediaId: string | null;
	requestRevealMedia: (mediaId: string) => void;
	clearHighlight: () => void;

	/* Media */
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	mediaSortBy: MediaSortKey;
	mediaSortOrder: MediaSortOrder;
	setMediaSort: (key: MediaSortKey, order: MediaSortOrder) => void;
}

export const useAssetsPanelStore = create<AssetsPanelStore>()(
	persist(
		(set) => ({
			activeTab: "library",
			setActiveTab: (tab) => set({ activeTab: tab }),
			librarySubTab: "media",
			setLibrarySubTab: (sub) => set({ librarySubTab: sub }),
			aiGenSubTab: "effects",
			setAIGenSubTab: (sub) => set({ aiGenSubTab: sub }),
			highlightMediaId: null,
			requestRevealMedia: (mediaId) =>
				set({ activeTab: "library", librarySubTab: "media", highlightMediaId: mediaId }),
			clearHighlight: () => set({ highlightMediaId: null }),
			mediaViewMode: "grid",
			setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
			mediaSortBy: "name",
			mediaSortOrder: "asc",
			setMediaSort: (key, order) =>
				set({ mediaSortBy: key, mediaSortOrder: order }),
		}),
		{
			name: "assets-panel",
			partialize: (state) => ({
				mediaViewMode: state.mediaViewMode,
				mediaSortBy: state.mediaSortBy,
				mediaSortOrder: state.mediaSortOrder,
			}),
		},
	),
);
