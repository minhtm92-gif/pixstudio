"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { TabBar } from "./tabbar";
import { LibraryView } from "./views/library";
import { StockView } from "./views/stock";
import { AIGenView } from "./views/ai-gen";
import { TemplatesView } from "./views/templates";
import { BrandKitView } from "./views/brand-kit";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		library: <LibraryView />,
		stock: <StockView />,
		aiGen: <AIGenView />,
		templates: <TemplatesView />,
		brandKit: <BrandKitView />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
