import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Screen Passport",
  description: "See where your favourite films and series were filmed near you. Visit them, stamp them, share them.",
};

export const viewport: Viewport = { themeColor: "#141414", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-[1100] bg-gradient-to-b from-paper via-paper/95 to-paper/0">
          <div className="mx-auto flex w-full max-w-screen-2xl items-center px-4 py-4 sm:px-8 lg:px-12">
            <Link href="/" className="text-lg font-black uppercase tracking-tight text-accent sm:text-xl">
              Screen Passport
            </Link>
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-ink/10">
          <div className="mx-auto flex w-full max-w-screen-2xl gap-4 px-4 pb-24 pt-6 text-xs text-ink/50 sm:px-8 lg:px-12">
            <Link href="/impressum" className="hover:text-ink">Impressum</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
