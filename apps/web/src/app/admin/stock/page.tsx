/**
 * Admin → Stock Libraries — anh manages 10-20 iStock + Envato + Shutterstock accounts.
 *
 * Per docs/preview/05-admin-stock.html.
 * ADMIN-only (User.systemRole === ADMIN).
 */

import type { Metadata } from "next";
import { AdminStockView } from "../../../components/pixstudio/admin-stock-view";

export const metadata: Metadata = {
	title: "Admin · Stock Libraries · PixStudio",
};

export default async function AdminStockPage() {
	const stubUser = {
		name: "Anh Minh",
		tier: "MAX" as const,
		buildsUsed: 0,
		buildsLimit: -1,
	};
	return <AdminStockView user={stubUser} />;
}
