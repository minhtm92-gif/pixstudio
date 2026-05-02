/**
 * Admin → AI Compute (GPU) — manual control DO L40S 48GB TOR1.
 *
 * Per docs/preview/06-admin-gpu.html.
 * ADMIN-only. $1.57/hr billing — manual Start/Destroy.
 */

import type { Metadata } from "next";
import { AdminGpuView } from "../../../components/pixstudio/admin-gpu-view";

export const metadata: Metadata = {
	title: "Admin · AI Compute · PixStudio",
};

export default async function AdminGpuPage() {
	const stubUser = {
		name: "Anh Minh",
		tier: "MAX" as const,
		buildsUsed: 0,
		buildsLimit: -1,
	};
	return <AdminGpuView user={stubUser} />;
}
