import type { ReactNode } from "react";

/** A small "i" that opens a short explanation on tap (no JavaScript, works on phones). */
export function InfoTip({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group/tip relative inline-block align-middle ${className}`}>
      <summary aria-label={label} title={label}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-ink/40 font-display text-xs text-ink/70 group-open/tip:border-accent group-open/tip:text-accent">i</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-64 max-w-[80vw] rounded-sm bg-paper p-3 text-sm leading-snug text-ink/85 shadow-xl shadow-black/50 ring-1 ring-ink/10">
        {children}
      </div>
    </details>
  );
}
