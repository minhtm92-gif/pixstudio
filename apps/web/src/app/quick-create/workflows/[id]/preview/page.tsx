/**
 * Quick Create — View 7 Final preview (per SCOPE §3.2).
 *
 * Video player + chat command edit + AI suggestion bubble + Edit/Download/Generate.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FinalPreview } from "../../../_components/final-preview";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ sessionId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	return { title: `Preview · ${id} · Quick Create · PixStudio` };
}

export default async function FinalPreviewPage({ params, searchParams }: PageProps) {
	const { id: workflowId } = await params;
	const { sessionId } = await searchParams;

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-5xl px-4 py-6">
				<Link
					href={`/quick-create/workflows/${workflowId}/build?sessionId=${sessionId ?? ""}`}
					className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Build
				</Link>
				{sessionId ? (
					<FinalPreview workflowId={workflowId} sessionId={sessionId} />
				) : (
					<div className="rounded-lg border bg-card p-8 text-center">
						<h2 className="text-lg font-semibold">Session ID required</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							Final preview needs a sessionId query param.
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
