"use client";

import { AssetStudioView } from "@/components/pixstudio/asset-studio-view";
import { useAuthUser } from "@/hooks/use-auth-user";

export function AssetStudioClient() {
	const { user } = useAuthUser();
	return <AssetStudioView user={user} />;
}
