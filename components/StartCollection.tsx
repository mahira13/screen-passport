"use client";

import { visitProgress } from "@/lib/collections";
import { toggleWatched } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";

/**
 * "Start this collection": adds the title to your passport. Progress counts places checked in on site;
 * the badge comes when every place is visited.
 */
export function StartCollection({ workId, placeIds }: { workId: string; placeIds: number[] }) {
  const { watched, visited } = usePassport();
  const started = watched.includes(workId);
  const p = visitProgress(placeIds, visited);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => toggleWatched(workId, null)} aria-pressed={started}
        className={`label inline-flex min-h-11 items-center gap-2 px-5 transition-colors ${
          started ? "border border-accent text-accent hover:bg-accent/10" : "bg-accent text-paper hover:bg-ink"}`}>
        {started ? <><span aria-hidden>✓</span> In your passport</> : "Start this collection"}
      </button>
      {(started || p.done > 0) && (
        <p className="label text-ink/70" role="status">
          {p.complete ? <span className="text-accent">★ Complete · </span> : null}
          {p.done} of {p.total} {p.total === 1 ? "place" : "places"} visited
        </p>
      )}
    </div>
  );
}
