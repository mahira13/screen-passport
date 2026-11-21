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
    <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-ink/10 bg-[#181818]/95 text-ink backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-8 lg:px-12 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Your Screen Passport</p>
          <p className="truncate text-sm">{parts.join(" · ")}</p>
          {sync === "error" && <p className="text-xs text-ink/60">Not saved yet, retrying…</p>}
        </div>
        {passportId ? (
          <Link href={`/p/${passportId}`} className="shrink-0 rounded bg-accent px-4 py-2 text-sm font-bold text-white">
            Open
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-ink/60">Saving…</span>
        )}
      </div>
    </div>
  );
}
