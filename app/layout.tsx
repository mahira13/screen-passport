import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Instrument_Serif, Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, BottomNavLive, SiteHeader, SiteHeaderLive, Wordmark } from "@/components/SiteHeader";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { TMDB_ATTRIBUTION } from "@/lib/tmdb";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Space Grotesk stays for the share and invite images (see the share-card skill).
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const condensed = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Screen Passport",
  description: "See where your favourite films and series were filmed near you. Visit them, stamp them, share them.",
};

export const viewport: Viewport = { themeColor: "#16213A", width: "device-width", initialScale: 1 };

const PILLARS = [
  ["Discover", "your cinema", "Real filming places from the films and series you love, each with a source."],
  ["Explore", "the world", "Turn them into a dated trip, walk it with friends, let Layla plan the rest."],
  ["Collect", "your stories", "Stamps, gold check-ins and collections in a passport worth sharing."],
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${serif.variable} ${condensed.variable} h-full antialiased`}>
      {/* Mobile: room for the bottom nav. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense fallback={<SiteHeader />}><SiteHeaderLive /></Suspense>
        {children}
        <footer className="mt-auto bg-paper">
          <div className="mx-auto w-full max-w-screen-2xl px-4 pb-28 pt-16 sm:px-8 lg:px-12">
            <ol className="grid gap-10 border-t border-ink/15 pt-10 md:grid-cols-3">
              {PILLARS.map(([verb, rest, text], i) => (
                <li key={verb}>
                  <p className="label text-ink/60">0{i + 1}</p>
                  <p className="mt-3 font-serif text-4xl leading-none sm:text-5xl">
                    {verb} <span className="italic text-accent">{rest}.</span>
                  </p>
                  <p className="mt-3 max-w-xs text-sm text-ink/60">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-ink/15 pt-6">
              <Wordmark />
              <nav aria-label="Legal" className="label flex gap-6 text-ink/65">
                <Link href="/impressum" className="inline-flex min-h-11 items-center hover:text-accent">Impressum</Link>
                <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-accent">Privacy</Link>
              </nav>
            </div>
            <p className="mt-6 max-w-2xl text-xs text-ink/60">
              {TMDB_ATTRIBUTION} Map data © OpenStreetMap contributors.
            </p>
          </div>
        </footer>
        <Suspense fallback={<BottomNav />}><BottomNavLive /></Suspense>
      </body>
    </html>
  );
}
