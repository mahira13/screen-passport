"use client";

import Link from "next/link";
import { usePassport } from "@/lib/use-passport";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 leading-none ${className}`}>
      <span className="font-serif text-2xl italic sm:text-[1.7rem]">Screen</span>
      <span className="font-condensed text-xl tracking-[0.12em] text-accent sm:text-2xl">Passport</span>
    </span>
  );
}

const navLink = "label hidden py-2 text-ink/70 transition-colors hover:text-accent md:inline";

export function SiteHeader() {
  const { id, watched } = usePassport();
  return (
    <header className="sticky top-0 z-[1100] border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-6 px-4 py-3 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Screen Passport home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-6">
          <Link href="/#discover" className={navLink}>Discover</Link>
          <Link href="/#index" className={navLink}>Explore</Link>
          <Link href="/#collections" className={navLink}>Collect</Link>
          {id ? (
            <Link href={`/p/${id}`}
              className="label inline-flex items-center gap-2 border border-accent px-3 py-2 text-accent transition-colors hover:bg-accent hover:text-night">
              My passport
              {watched.length > 0 && <span className="font-condensed text-sm tracking-normal">{watched.length}</span>}
            </Link>
          ) : (
            <Link href="/#discover" className="label border border-ink/30 px-3 py-2 text-ink transition-colors hover:border-accent hover:text-accent md:hidden">
              Discover
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
