/**
 * Brand kit tab — SCOPE §3.1 fifth asset panel + PW-32.
 *
 * Pro/Max tier: logos, fonts, colors, intro/outro presets.
 * Reuses existing OpenCut SettingsView (project-level brand defaults) until
 * Phase 3 ships full Brand Kit manager (PW-32).
 */

"use client";

import { Palette, Crown } from "lucide-react";
import { SettingsView } from "./settings";

export function BrandKitView() {
	return (
		<div className="flex h-full flex-col">
			<div className="border-b bg-card/50 px-3 py-2 flex items-center gap-2">
				<Palette className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold">Brand kit</span>
				<span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
					<Crown className="h-3 w-3" />
					Pro/Max
				</span>
			</div>
			<div className="flex-1 overflow-hidden">
				<SettingsView />
			</div>
		</div>
	);
}
