import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description:
    "VISION MTF reads Weekly down to 15M and explains why it is WAITING — not just BUY/SELL. Multi-timeframe AI analysis for XAUUSD and BTCUSD.",
  keywords: [
    "VISION MTF",
    "multi timeframe trading",
    "AI trading signals",
    "XAUUSD signals",
    "BTCUSD signals",
    "prop firm",
    "order block",
    "fair value gap",
    "break of structure",
    "MT5 expert advisor",
  ],
  authors: [{ name: site.legalName }],
  creator: site.legalName,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description:
      "The first AI that sees the market like you do. Weekly → 15M confluence for XAUUSD & BTC, with full reasoning on every call.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description:
      "Weekly → 15M multi-timeframe AI for XAUUSD & BTC. It tells you why it is WAITING.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        {/* the hero SVG references the mark directly — preload it for LCP */}
        <link rel="preload" as="image" href="/logo-mark.png" />
      </head>
      <body className="bg-ink text-white">{children}</body>
    </html>
  );
}
