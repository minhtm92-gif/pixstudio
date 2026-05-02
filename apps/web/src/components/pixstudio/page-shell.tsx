/**
 * PageShell — shared layout (Sidebar + main column) for PixStudio surfaces.
 *
 * Use this for any new page that should match Dashboard/Asset Studio chrome.
 * Existing 4 view components inline the same wrapper — fold them in next sweep.
 */

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import type { PixStudioUser } from "@/lib/api-client";

export function PageShell({
	user,
	children,
}: {
	user?: PixStudioUser;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-screen bg-black">
			<Sidebar user={user} />
			<main className="flex flex-1 flex-col overflow-x-hidden">{children}</main>
		</div>
	);
}
