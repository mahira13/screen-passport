"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNav, NAV, type NavKey, passportHref } from "@/lib/nav";
import { usePassport } from "@/lib/use-passport";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 leading-none ${className}`}>
      <span className="font-display text-2xl sm:text-[1.7rem]">Screen</span>
      <span className="font-display text-xl tracking-[0.12em] text-accent sm:text-2xl">Passport</span>
    </span>
  );
}

// Thin line icons for the mobile bar (24 px grid, currentColor).
const ICONS: Record<NavKey, React.ReactNode> = {
  discover: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  collections: <><rect x="3" y="7" width="13" height="13" /><path d="M7 3h14v14" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  passport: <><rect x="5" y="3" width="14" height="18" rx="1" /><circle cx="12" cy="10" r="3" /><path d="M9 16h6" /></>,
};

function useNav(active: NavKey | null) {
  const { id, watched } = usePassport();
  const items = NAV.map((n) => ({ ...n, href: n.key === "passport" ? passportHref(id) : n.href, current: n.key === active }));
  return { items, count: watched.length };
}

type NavProps = { active?: NavKey | null }; // null: nothing highlighted (the Suspense fallback)

/** The nav for the current path. usePathname needs a Suspense boundary, so these wrap the plain ones. */
export const SiteHeaderLive = () => <SiteHeader active={activeNav(usePathname())} />;
export const BottomNavLive = () => <BottomNav active={activeNav(usePathname())} />;

export function SiteHeader({ active = null }: NavProps) {
  const { items, count } = useNav(active);
  return (
    <header className="sticky top-0 z-[1100] border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-6 px-4 py-3 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Screen Passport home" className="inline-flex min-h-11 items-center">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-8 md:flex">
          {items.map((n) => (
            <Link key={n.key} href={n.href} aria-current={n.current ? "page" : undefined}
              className={`label relative inline-flex min-h-11 items-center gap-2 transition-colors hover:text-accent ${n.current ? "text-accent" : "text-ink/70"}`}>
              {n.label}
              {n.key === "passport" && count > 0 && <span className="font-display text-sm tracking-normal">{count}</span>}
              {n.current && <span aria-hidden className="absolute inset-x-0 bottom-1.5 h-px bg-accent" />}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** Mobile: the same four sections as a bottom bar. */
export function BottomNav({ active = null }: NavProps) {
  const { items, count } = useNav(active);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[1100] border-t border-ink/15 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="grid h-16 grid-cols-4">
        {items.map((n) => (
          <li key={n.key}>
            <Link href={n.href} aria-current={n.current ? "page" : undefined}
              className={`relative flex h-full flex-col items-center justify-center gap-1 transition-colors ${n.current ? "text-accent" : "text-ink/65"}`}>
              {n.current && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 bg-accent" />}
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
                {ICONS[n.key]}
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                {n.label}
                {n.key === "passport" && count > 0 && <span className="ml-1 font-display text-xs tracking-normal">{count}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
