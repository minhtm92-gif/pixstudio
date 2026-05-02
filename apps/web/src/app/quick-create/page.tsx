/**
 * Quick Create — Hero View (Phase 1 Sprint 1 Story 1.1).
 *
 * Path A entry: textarea 25K char + workflow browse link + Path B mode toggle.
 * Per SCOPE.md §13 + docs/quick-create/acceptance-criteria-draft.md.
 *
 * Server integration Sprint 2 (POST /api/quick-create/sessions).
 */

import { Metadata } from "next";
import { HeroView } from "./_components/hero-view";

export const metadata: Metadata = {
	title: "Quick Create · PixStudio",
	description:
		"Tạo video AI từ ý tưởng hoặc video tham khảo trong vài phút. Choose từ 8 workflow tune sẵn.",
};

export default function QuickCreatePage() {
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-5xl px-4 py-12">
				<HeroView />
			</div>
		</main>
	);
}
