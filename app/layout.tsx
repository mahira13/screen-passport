import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, BottomNavLive, SiteHeader, SiteHeaderLive, Wordmark } from "@/components/SiteHeader";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { TMDB_ATTRIBUTION } from "@/lib/tmdb";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Space Grotesk stays for the share and invite images (see the share-card skill).
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Screen Passport",
  description: "See where your favourite films and series were filmed near you. Visit them, stamp them, share them.",
};

export const viewport: Viewport = { themeColor: "#16213A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} h-full antialiased`}>
      {/* Mobile: room for the bottom nav. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense fallback={<SiteHeader />}><SiteHeaderLive /></Suspense>
        {children}
        <footer className="mt-auto bg-paper">
          <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-12 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-6 border-t border-ink/10 pt-6">
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
