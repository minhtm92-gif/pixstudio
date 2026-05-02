/**
 * Quick Create — Outline Review (View 4, Phase 1 Sprint 2 Story 1.6).
 *
 * Per SCOPE.md §13: title card auto-generated + chip selector
 * (Audience / Look & Feel / Platform). Per-chip "Dịch" translate VN ↔ EN.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OutlineReview } from "../../../_components/outline-review";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ sessionId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	return { title: `Outline · ${id} · Quick Create · PixStudio` };
}

export default async function OutlineReviewPage({ params, searchParams }: PageProps) {
	const { id: workflowId } = await params;
	const { sessionId } = await searchParams;

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Link
					href={`/quick-create/workflows/${workflowId}/config`}
					className="mb-4 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Config
				</Link>

				<OutlineReview workflowId={workflowId} sessionId={sessionId ?? "stub"} />
			</div>
		</main>
	);
}
