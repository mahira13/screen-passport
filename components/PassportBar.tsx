"use client";

import Link from "next/link";
import { formatDistance } from "@/lib/distance";
import type { PassportSummary } from "@/lib/passport";
import type { SyncStatus } from "@/lib/passport-store";

type Props = { summary: PassportSummary; passportId: string | null; sync: SyncStatus };

export function PassportBar({ summary: s, passportId, sync }: Props) {
  if (s.titles === 0) return null;
  const parts = [
    `${s.titles} ${s.titles === 1 ? "title" : "titles"}`,
    `${s.places} ${s.places === 1 ? "place" : "places"}`,
    ...(s.closestKm !== null ? [`closest ${formatDistance(s.closestKm)}`] : []),
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] bg-navy text-cream shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-wide text-gold">Your Screen Passport</p>
          <p className="truncate text-sm">{parts.join(" · ")}</p>
          {sync === "error" && <p className="text-xs text-cream/70">Not saved yet, retrying…</p>}
        </div>
        {passportId ? (
          <Link href={`/p/${passportId}`} className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-navy">
            Open
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-cream/70">Saving…</span>
        )}
      </div>
    </div>
  );
}
