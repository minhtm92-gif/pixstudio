/**
 * Quick Create — Editor (View 6, Phase 1 Sprint 4 Story 1.9-1.12).
 *
 * 3-tab editor: Edit media / Edit script / Edit music + Trim Dialog modal.
 * Per SCOPE.md §13.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditorShell } from "../../../_components/editor/editor-shell";

interface PageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ projectId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	return { title: `Editor · ${id} · Quick Create · PixStudio` };
}

export default async function EditorPage({ params, searchParams }: PageProps) {
	const { id: workflowId } = await params;
	const { projectId } = await searchParams;

	if (!projectId) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background">
				<div className="rounded-lg border bg-card p-8 text-center">
					<h2 className="text-lg font-semibold">Project ID required</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Editor needs a projectId query param.
					</p>
					<Link
						href={`/quick-create/workflows/${workflowId}/build`}
						className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Build
					</Link>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-background">
			<EditorShell projectId={projectId} />
		</main>
	);
}
