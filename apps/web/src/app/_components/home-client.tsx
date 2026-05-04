"use client";

import { DashboardView } from "@/components/pixstudio/dashboard-view";
import { useAuthUser } from "@/hooks/use-auth-user";

export function HomeClient() {
	const { user } = useAuthUser();
	return <DashboardView user={user} />;
}
