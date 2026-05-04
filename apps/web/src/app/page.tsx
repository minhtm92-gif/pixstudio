import type { Metadata } from "next";
import { SITE_URL } from "@/site/brand";
import { HomeClient } from "./_components/home-client";

export const metadata: Metadata = {
	title: "PixStudio — Dashboard",
	alternates: { canonical: SITE_URL },
};

export default function Home() {
	return <HomeClient />;
}
