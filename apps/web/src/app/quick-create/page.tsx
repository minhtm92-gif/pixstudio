/**
 * /quick-create — DEPRECATED entry hero. Redirects to /.
 *
 * Per anh feedback (2026-05-03): Quick Create entry textarea lives in Home
 * dashboard (/) under the "Quick Create" tab. Having a duplicate hero on
 * /quick-create created confusion (two textareas, two send buttons). Now
 * Home is the single entry point — this page just bounces users back so
 * old links still work.
 *
 * Path B (paste video URL) entry deferred to Sprint 27+ — will re-add as
 * a toggle inside Home Quick Create tab.
 */

import { redirect } from "next/navigation";

export default function QuickCreatePage() {
	redirect("/");
}
