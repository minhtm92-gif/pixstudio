/**
 * Quick Create — Workflow Config (View 3, Phase 1 Sprint 1 Story 1.3).
 *
 * Per SCOPE.md §13: 5 numbered settings + workflow-specific fields.
 * Form auto-fills defaults from workflow template, user overrides what they want.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConfigForm } from "../../_components/config-form";

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: `Configure ${id} · Quick Create · PixStudio`,
	};
}

export default async function WorkflowConfigPage({ params }: PageProps) {
	const { id } = await params;
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto max-w-3xl px-4 py-8">
				{/* Breadcrumb */}
				<Link
					href="/quick-create/workflows"
					className="mb-4 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Workflows
				</Link>

				<ConfigForm workflowId={id} />
			</div>
		</main>
	);
}
