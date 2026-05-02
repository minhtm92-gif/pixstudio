/**
 * Asset Studio — 5 tab library shared by Editor + Creator.
 *
 * Per docs/preview/04-asset-studio.html.
 * Tabs: Video / Image / Character / Music / Script & Templates
 * Federated search across: Uploaded / Stock pool admin / AI gen / Crossian RAG
 */

import type { Metadata } from "next";
import { AssetStudioView } from "../../components/pixstudio/asset-studio-view";

export const metadata: Metadata = {
	title: "Asset Studio · PixStudio",
};

export default async function AssetsPage() {
	const stubUser = {
		name: "Anh Minh",
		tier: "PRO" as const,
		buildsUsed: 32,
		buildsLimit: 50,
	};
	return <AssetStudioView user={stubUser} />;
}
