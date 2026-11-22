"use client";

import Link from "next/link";
import { formatDistance } from "@/lib/distance";
import type { PassportSummary } from "@/lib/passport";
import type { SyncStatus } from "@/lib/passport-store";

type Props = { summary: PassportSummary; passportId: string | null; sync: SyncStatus };

const Stat = ({ n, label }: { n: string | number; label: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="font-condensed text-2xl leading-none text-ink">{n}</span>
    <span className="label text-ink/60">{label}</span>
  </span>
);

export function PassportBar({ summary: s, passportId, sync }: Props) {
  if (s.titles === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[1000] md:bottom-0 border-t-2 border-accent bg-paper/95 text-ink backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-8 lg:px-12 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span aria-hidden className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent font-serif text-lg italic text-accent sm:flex">
          SP
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg italic leading-none text-accent">Your Screen Passport</p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
            <Stat n={s.titles} label={s.titles === 1 ? "title" : "titles"} />
            <Stat n={s.places} label={s.places === 1 ? "place" : "places"} />
            {s.closestKm !== null && <span className="label hidden self-center text-ink/60 sm:inline">closest {formatDistance(s.closestKm)}</span>}
          </p>
          {sync === "error" && <p className="text-xs text-ink/60">Not saved yet, retrying…</p>}
        </div>
        {passportId ? (
          <Link href={`/p/${passportId}`} className="label inline-flex min-h-11 shrink-0 items-center bg-accent px-5 text-paper transition-colors hover:bg-ink">
            Open passport →
          </Link>
        ) : (
          <span className="label shrink-0 text-ink/60">Saving…</span>
        )}
      </div>
    </div>
  );
}
