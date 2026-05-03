/**
 * Stock tab — SCOPE §3.1 second asset panel + D17.
 *
 * Federated search across admin pool (10-20 accounts iStock + Envato +
 * Shutterstock managed by anh Minh). User sees vendor badge only, never
 * account_id. Phase 2 wires real search via /api/stock/search.
 */

"use client";

import { Store, Search, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const VENDORS = [
	{ id: "istock", name: "iStock", description: "Premium photos + videos + illustrations" },
	{ id: "envato", name: "Envato", description: "Music + sound effects + motion graphics" },
	{ id: "shutterstock", name: "Shutterstock", description: "Stock photos + 4K video clips" },
];

export function StockView() {
	return (
		<div className="flex h-full flex-col">
			<div className="border-b bg-card/50 px-3 py-2">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search stock library…"
						disabled
						className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground/50"
					/>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-3">
				<div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
					<Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
					<span className="text-amber-700 dark:text-amber-400">
						Phase 2 ships federated stock search (X-10). Admin pool managed via
						Settings → Admin → Stock Libraries.
					</span>
				</div>

				<div className="space-y-2">
					<div className="text-xs font-semibold uppercase text-muted-foreground">
						Vendor pool
					</div>
					{VENDORS.map((v) => (
						<div
							key={v.id}
							className="flex items-start gap-3 rounded-md border bg-card p-3"
						>
							<Store className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">{v.name}</span>
									<Badge variant="outline" className="text-[10px]">
										Admin pool
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground">{v.description}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
