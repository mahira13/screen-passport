"use client";

import { collectionProgress, visitProgress } from "@/lib/collections";
import { usePassport } from "@/lib/use-passport";
import type { Photo } from "@/lib/nearby";
import { PhotoCard } from "./PhotoCard";

export type ChallengeCollection = {
  id: string; // unique key: "curated:<id>", "city:<slug>", "title:<work id>"
  href: string;
  kind: "curated" | "city" | "title";
  tripFrom: string | null; // ?from= for a trip: a start city id or "lat,lng"
  name: string; // the card name (a title collection shows the title)
  line: string; // type and year, or up to three title names
  city: string | null;
  from: string | null; // start city id for a trip, when the collection's city is one
  description: string | null;
  works: { id: string; title: string; live: boolean }[]; // live: has places on the map
  places: { id: number; checkIn: boolean }[]; // published places of these titles; checkIn: precise pin
  cover: Photo | null; // photo of the first featured place, if it has one
};

type Props = { c: ChallengeCollection; watched: string[]; visited: number[]; big: boolean };

function Challenge({ c, watched, visited, big }: Props) {
  // Progress = places checked in on site; watched titles are the second line.
  const p = visitProgress(c.places.map((x) => x.id), visited);
  const w = collectionProgress({ id: c.id, name: c.name, city: c.city, work_ids: c.works.map((x) => x.id), description: null }, watched);
  const been = new Set(visited);
  return (
    <PhotoCard href={c.href} title={c.name} photo={c.cover} big={big} overlay aspect={big ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[4/3]"}
      eyebrow={c.city ?? undefined}
      badge={p.complete && (
        <span aria-label="Collection complete" className="flex h-16 w-16 rotate-[-12deg] flex-col items-center justify-center rounded-full border-[3px] border-double border-accent bg-paper/80 text-center text-accent backdrop-blur-sm">
          <span className="font-display text-[11px] leading-none tracking-widest">Complete</span>
        </span>
      )}
      meta={<>
        <span className="block truncate">{c.line}</span>
        <span className="mt-2 flex gap-1" role="img" aria-label={`Visited ${p.done} of ${p.total} places`}>
          {c.places.map((x) => <span key={x.id} className={`h-1 flex-1 rounded-full ${been.has(x.id) ? "bg-accent" : "bg-ink/15"}`} />)}
        </span>
        <span className="mt-1.5 block text-xs">
          <span className="text-ink">{p.done}/{p.total}</span> places visited
          {c.works.length > 1 && ` · ${w.done}/${w.total} watched`}
        </span>
      </>} />
  );
}

/** Collections as small cinematic adventures. Complete (a badge) when every place was checked in. */
export function CollectionChallenges({ collections }: { collections: ChallengeCollection[] }) {
  const { watched, visited } = usePassport();
  const shown = collections.filter((c) => c.works.length > 0);
  if (shown.length === 0) return null;
  const done = shown.filter((c) => visitProgress(c.places.map((x) => x.id), visited).complete).length;

  return (
    <section id="collections" className="mx-auto w-full max-w-screen-xl scroll-mt-16 px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none tracking-tight sm:text-6xl">Collections</h1>
          <p className="mt-3 text-ink/65">Visit every place in a set to complete it.</p>
        </div>
        {visited.length > 0 && <p className="text-sm text-ink/65"><span className="font-display text-2xl text-ink">{done}</span> of {shown.length} complete</p>}
      </div>
      <ul className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c, i) => (
          <li key={c.id} className={i === 0 ? "sm:col-span-2" : ""}>
            <Challenge c={c} watched={watched} visited={visited} big={i === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}
