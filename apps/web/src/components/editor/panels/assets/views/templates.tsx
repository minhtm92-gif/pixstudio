/**
 * Templates tab — SCOPE §3.1 fourth asset panel.
 *
 * Phase 1: 30 templates inventory (T-1).
 * Phase 2: +50 Crossian-RAG-suggested templates (T-2, RAG hidden per D35).
 * Phase 3: cultural VN bundles Tết/Trung Thu/Quốc Khánh/Black Friday (T-3).
 */

"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TemplatesView() {
	const router = useRouter();
	return (
		<div className="flex h-full flex-col p-4">
			<div className="mb-3 flex items-center gap-2">
				<Sparkles className="h-4 w-4 text-primary" />
				<h3 className="text-sm font-semibold">Templates</h3>
			</div>

			<div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs mb-4">
				<div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
					<Lock className="h-3.5 w-3.5" />
					<span className="font-medium">Phase 1 ships 30 templates inventory (T-1).</span>
				</div>
				<p className="mt-1 text-muted-foreground">
					Browse Quick Create workflows for now — same template engine, different entry.
				</p>
			</div>

			<Button
				variant="outline"
				className="justify-between"
				onClick={() => router.push("/quick-create/workflows")}
			>
				<span className="flex items-center gap-2">
					<Sparkles className="h-4 w-4" />
					Browse Quick Create workflows
				</span>
				<ArrowRight className="h-4 w-4" />
			</Button>
		</div>
	);
}
