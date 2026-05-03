import type { Metadata } from "next";
import { SITE_URL } from "@/site/brand";
import { DashboardView } from "../components/pixstudio/dashboard-view";
import type { PixStudioUser } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "PixStudio — Dashboard",
	alternates: { canonical: SITE_URL },
};

export default async function Home() {
	// Sprint 9 polish: fetch user from session cookie via server component.
	// v1: stub demo user — alpha testers see "Demo Mode" badge in dashboard.
	const stubUser: PixStudioUser = {
		name: "Demo",
		tier: "PRO",
		buildsUsed: 0,
		buildsLimit: 50,
	};

	return <DashboardView user={stubUser} />;
}
