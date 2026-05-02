import type { Metadata } from "next";
import { SITE_URL } from "@/site/brand";
import { DashboardView } from "../components/pixstudio/dashboard-view";

export const metadata: Metadata = {
	title: "PixStudio — Dashboard",
	alternates: { canonical: SITE_URL },
};

export default async function Home() {
	// Sprint 9 polish: fetch user from session cookie via server component
	// v1: stub user for unauthenticated preview
	const stubUser = {
		name: "Anh Minh",
		tier: "PRO" as const,
		buildsUsed: 0,
		buildsLimit: 50,
	};

	return <DashboardView user={stubUser} />;
}
