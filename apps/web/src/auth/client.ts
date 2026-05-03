import { createAuthClient } from "better-auth/react";
import { API_BASE } from "@/lib/api-client";

// PixStudio split arch: better-auth handler lives on apps/api (Fly.io), not
// on the apps/web origin. Client must POST to API_BASE/api/auth/*, not the
// site URL. Using NEXT_PUBLIC_SITE_URL (which defaults to localhost:3000)
// caused the signup form to hit localhost from Vercel deployment.
export const { signIn, signUp, signOut, useSession } = createAuthClient({
	baseURL: API_BASE,
});
