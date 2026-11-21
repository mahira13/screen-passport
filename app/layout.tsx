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

export const viewport: Viewport = { themeColor: "#16213A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mx-auto mt-auto w-full max-w-xl px-4 pb-24 pt-6 text-xs text-navy/60">
          <Link href="/impressum" className="underline underline-offset-2">Impressum</Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        </footer>
      </body>
    </html>
  );
}
