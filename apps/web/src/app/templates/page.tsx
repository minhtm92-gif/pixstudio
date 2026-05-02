/**
 * Templates page — Phase 1 stub.
 *
 * Actual template gallery ships Phase 2 (template scraping + per-platform/purpose
 * filtering). Hero CTA points to Quick Create which already covers the scaffolding.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/pixstudio/page-shell";
import type { PixStudioUser } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "Templates · PixStudio",
};

const STUB_USER: PixStudioUser = {
	name: "Demo",
	tier: "PRO",
	buildsUsed: 0,
	buildsLimit: 50,
};

export default function TemplatesPage() {
	return (
		<PageShell user={STUB_USER}>
			<div className="px-8 pt-6">
				<div className="mb-2 font-mono text-xs text-white/50">Home / Templates</div>
				<h1 className="font-serif text-3xl font-normal text-zinc-300">Templates</h1>
				<p className="mt-1.5 text-sm text-white/50">
					Preset workflows tune sẵn theo platform × purpose × cultural VN.
					Phase 2 ship full gallery — hiện tại Quick Create đã cover 9 workflow.
				</p>
			</div>

			<div className="mx-auto w-full max-w-2xl px-8 py-16">
				<div className="rounded-xl border border-dashed border-white/10 bg-zinc-900 p-10 text-center">
					<LayoutGrid className="mx-auto mb-4 h-10 w-10 text-white/30" />
					<h2 className="mb-2 font-serif text-xl text-zinc-300">Coming Phase 2</h2>
					<p className="mb-6 text-sm text-white/50">
						Template gallery với 50+ preset (UGC review, FB ad, TikTok hook, YouTube
						intro, Reel transitions, Tết bundle, ...). Hôm nay anh có thể bắt đầu
						với Quick Create — chứa 9 workflow tune sẵn.
					</p>
					<Link
						href="/quick-create"
						className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90"
					>
						Mở Quick Create
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</PageShell>
	);
}
