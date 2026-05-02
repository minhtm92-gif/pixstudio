/**
 * Quick Create — Build progress (View 5, Phase 1 Sprint 2 Story 1.7).
 *
 * 5-stage spinner with progress bar. Sprint 2 mock — real WS subscribe Sprint 2.5.
 */

import type { Metadata } from "next";
import { BuildProgress } from "../../../_components/build-progress";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ sessionId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	return { title: `Building · ${id} · Quick Create · PixStudio` };
}

export default async function BuildProgressPage({ params, searchParams }: PageProps) {
	const { id: workflowId } = await params;
	const { sessionId } = await searchParams;
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-2xl px-4 py-12">
				<BuildProgress workflowId={workflowId} sessionId={sessionId ?? "stub"} />
			</div>
		</main>
	);
}
