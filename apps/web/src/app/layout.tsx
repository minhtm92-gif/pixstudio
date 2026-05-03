import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { ChangelogNotification } from "@/changelog/components/changelog-notification";
import { BugReportWidget } from "../components/bug-report-widget";
import { TooltipProvider } from "../components/ui/tooltip";
import { baseMetaData } from "./metadata";
import { BotIdClient } from "botid/client";
import { webEnv } from "@/env/web";
import { Inter } from "next/font/google";

const siteFont = Inter({ subsets: ["latin"] });

export const metadata = baseMetaData;

const protectedRoutes = [
	{
		path: "/none",
		method: "GET",
	},
];

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<BotIdClient protect={protectedRoutes} />
				{process.env.NODE_ENV === "development" && (
					<>
						<Script
							src="//unpkg.com/react-scan/dist/auto.global.js"
							crossOrigin="anonymous"
							strategy="beforeInteractive"
						/>
					</>
				)}
			</head>
			<body className={`${siteFont.className} font-sans antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange={true}
				>
					<TooltipProvider>
						<Toaster />
						{/* Databuddy analytics removed — OpenCut leftover client_id
						   `UP-Wcoy5arxFeK7oyjMMZ` returns 403 in production.
						   PixStudio does not have own Databuddy account yet. */}
						{children}
						<BugReportWidget />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
