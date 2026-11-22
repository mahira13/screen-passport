"use client";

import { visitProgress } from "@/lib/collections";
import { usePassport } from "@/lib/use-passport";

/** Progress = places checked in on site, as for every collection. */
export function CollectionVisits({ placeIds }: { placeIds: number[] }) {
  const { visited } = usePassport();
  const p = visitProgress(placeIds, visited);
  const been = new Set(visited);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label text-ink/60">Places visited</span>
        <span className="font-display text-3xl leading-none text-accent">{p.done}<span className="text-ink/60">/{p.total}</span></span>
      </div>
      <div className="mt-2 flex gap-1" role="img" aria-label={`Visited ${p.done} of ${p.total} places`}>
        {placeIds.map((id) => <span key={id} className={`h-1.5 flex-1 ${been.has(id) ? "bg-accent" : "bg-ink/15"}`} />)}
      </div>
      {p.complete && <p className="label mt-2 text-accent">★ Complete</p>}
    </div>
  );
}
