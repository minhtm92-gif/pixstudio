/**
 * Asset Studio — 5 tab library shared by Editor + Creator.
 *
 * Per docs/preview/04-asset-studio.html.
 * Tabs: Video / Image / Character / Music / Script & Templates
 * Federated search across: Uploaded / Stock pool admin / AI gen / Characters
 */

import type { Metadata } from "next";
import { AssetStudioClient } from "./_client";

export const metadata: Metadata = {
	title: "Asset Studio · PixStudio",
};

export default function AssetsPage() {
	return <AssetStudioClient />;
}
