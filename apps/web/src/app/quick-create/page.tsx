/**
 * /quick-create — DEPRECATED entry hero. Redirects to / preserving prompt query.
 *
 * Per anh feedback (2026-05-03): Quick Create entry textarea lives in Home
 * dashboard (/) under the "Quick Create" tab. Having a duplicate hero on
 * /quick-create created confusion (two textareas, two send buttons). Now
 * Home is the single entry point — this page just bounces users back so
 * old links still work.
 *
 * Audit BUG #11: redirect now preserves `?prompt=...` query so suggestion
 * chips like "Tạo video Tết" pre-fill the Home Hero textarea.
 */

import { redirect } from "next/navigation";

export default async function QuickCreatePage({
	searchParams,
}: {
	searchParams: Promise<{ prompt?: string }>;
}) {
	const { prompt } = await searchParams;
	if (prompt && prompt.trim()) {
		redirect(`/quick-create/workflows?prompt=${encodeURIComponent(prompt)}`);
	}
	redirect("/");
}
