import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";
import { themeInitScript } from "@/lib/theme";
// Self-hosted brand fonts (no request to Google Fonts at build or page load).
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: `${env.siteName} — Daily surf reports for UK beaches`, template: `%s | ${env.siteName}` },
  description:
    "Free, twice-daily surf forecasts for the UK's best surf spots: wave height, swell, wind, tides, best surf times and star ratings for Cornwall, Devon, Wales, Yorkshire, Scotland and Northern Ireland.",
  applicationName: env.siteName,
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEEE7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D0E" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
