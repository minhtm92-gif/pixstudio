/**
 * Inspector outer 4-tab shell — SCOPE §3.1 right-column.
 *
 * 4 fixed tabs: Inspector / AI / Comments / Versions.
 * Per D35, NO Crossian RAG tab — the RAG layer is invisible (background only).
 *
 * - Inspector: element-type properties (existing OpenCut PropertiesPanel content)
 * - AI: AI assistant + magic tools (Phase 2 wires Caption AI, BG remove, Upscale,
 *   Brainstorming chat per PW-23/PW-22/PW-28)
 * - Comments: Frame.io-style timestamped comments (Phase 3 PW-30, Pro tier)
 * - Versions: Project version history + restore (Phase 3 PW-31, Pro tier)
 */

"use client";

import { useState } from "react";
import { Sparkles, MessageSquare, History, Settings2, Lock } from "lucide-react";
import { cn } from "@/utils/ui";
import { PropertiesPanel } from ".";

type OuterTab = "inspector" | "ai" | "comments" | "versions";

const TAB_DEF: Array<{
	id: OuterTab;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ id: "inspector", label: "Inspector", icon: Settings2 },
	{ id: "ai", label: "AI", icon: Sparkles },
	{ id: "comments", label: "Comments", icon: MessageSquare },
	{ id: "versions", label: "Versions", icon: History },
];

interface InspectorShellProps {
	projectId?: string;
}

export function InspectorShell({ projectId }: InspectorShellProps) {
	const [activeTab, setActiveTab] = useState<OuterTab>("inspector");

	return (
		<div className="panel bg-background flex h-full flex-col overflow-hidden rounded-sm border">
			{/* Outer tab bar */}
			<div className="flex items-center border-b bg-card/30 px-1.5 py-1">
				{TAB_DEF.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
								activeTab === tab.id
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							<Icon className="h-3.5 w-3.5" />
							<span>{tab.label}</span>
						</button>
					);
				})}
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === "inspector" && <PropertiesPanel />}
				{activeTab === "ai" && <AITabPlaceholder />}
				{activeTab === "comments" && <CommentsTabPlaceholder />}
				{activeTab === "versions" && <VersionsTabPlaceholder projectId={projectId} />}
			</div>
		</div>
	);
}

function AITabPlaceholder() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
			<Sparkles className="h-8 w-8 text-primary/60" />
			<p className="font-medium text-foreground">AI tools</p>
			<p className="max-w-xs text-xs">
				Caption AI · BG remove · Upscale 4K · Brainstorming chat — Phase 2
				(PW-14/PW-23/PW-22/PW-28).
			</p>
			<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
				<Lock className="h-3 w-3" />
				Phase 2
			</div>
		</div>
	);
}

function CommentsTabPlaceholder() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
			<MessageSquare className="h-8 w-8 text-primary/60" />
			<p className="font-medium text-foreground">Comments</p>
			<p className="max-w-xs text-xs">
				Frame.io-style timestamped feedback. Phase 3 (PW-30, Pro tier).
			</p>
			<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
				<Lock className="h-3 w-3" />
				Phase 3 · Pro
			</div>
		</div>
	);
}

function VersionsTabPlaceholder({ projectId: _projectId }: { projectId?: string }) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
			<History className="h-8 w-8 text-primary/60" />
			<p className="font-medium text-foreground">Version history</p>
			<p className="max-w-xs text-xs">
				Auto-snapshot + manual labels + restore. Backend ProjectVersion table is
				live (Phase 1) — UI ships Phase 3 (PW-31, Pro tier).
			</p>
			<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
				<Lock className="h-3 w-3" />
				Phase 3 · Pro
			</div>
		</div>
	);
}
