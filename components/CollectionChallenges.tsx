"use client";

import Link from "next/link";
import { visitProgress } from "@/lib/collections";
import type { MissionInfo } from "@/lib/mission";
import { usePassport } from "@/lib/use-passport";
import type { Photo } from "@/lib/nearby";
import { Cover } from "./Cover";
import { FrameProgress, Reels } from "./MissionBits";

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
  mission: MissionInfo; // difficulty from real places
};

const Lock = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/** A mission as a cinema ticket: photo and name, a torn-off stub with the scene count and city. */
export function MissionTicket({ c, visited }: { c: ChallengeCollection; visited: number[] }) {
  const m = c.mission;
  const p = visitProgress(c.places.map((x) => x.id), visited);
  const body = (
    <>
      <div className="relative min-w-0 flex-1 bg-surface">
        <div className="relative">
          <Cover photo={c.cover} label={c.name} className={`aspect-[16/10] ${m.locked ? "grayscale" : ""}`} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-7 pt-16">
            <h3 className="font-display text-2xl font-bold leading-[1] tracking-tight text-ink drop-shadow sm:text-3xl">{c.name}</h3>
          </div>
          {p.complete && (
            <span className="stamp-drop absolute right-3 top-3 z-10 rounded-full border-[3px] border-double border-accent bg-paper/85 px-3 py-2 font-display text-xs font-bold uppercase tracking-widest text-accent" style={{ ["--tilt" as string]: "-10deg" }}>
              That&apos;s a wrap
            </span>
          )}
        </div>
        <div className="space-y-2.5 px-4 py-3.5">
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-ink/80">{m.line}</span>
            <span className="shrink-0"><Reels n={m.reels} label={m.level} /></span>
          </p>
          {m.locked ? (
            <p className="label text-ink/60">Coming soon</p>
          ) : (
            <>
              <FrameProgress done={p.done} total={p.total} />
              <p className="text-xs text-ink/65">{p.done === 0 ? "No stamps yet. Lights, camera…" : p.complete ? "Every scene stamped." : `${p.done} of ${p.total} scenes stamped`}</p>
            </>
          )}
        </div>
      </div>

      {/* Stub: cream ticket paper behind a dashed tear line. */}
      <div className="relative flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-ink px-1 text-center text-paper sm:w-24 ticket-tear">
        <span aria-hidden className="ticket-notch -top-2.5" />
        <span aria-hidden className="ticket-notch -bottom-2.5" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Admit one</span>
        <span className="font-display text-4xl font-bold leading-none">{m.locked ? <Lock /> : m.scenes}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{m.locked ? "Soon" : m.scenes === 1 ? "Scene" : "Scenes"}</span>
        <span className="mt-2 line-clamp-2 text-[10px] font-semibold uppercase leading-tight tracking-wider opacity-70">{c.city ?? (m.cities > 1 ? `${m.cities} cities` : "")}</span>
      </div>
    </>
  );

  if (m.locked) {
    return <div aria-label={`${c.name}: coming soon`} className="flex overflow-hidden rounded-sm opacity-55">{body}</div>;
  }
  // Stretched link under the photo credit (which stays clickable), over everything else.
  return (
    <article className="lift group relative flex overflow-hidden rounded-sm">
      {body}
      <Link href={c.href} aria-label={`${c.name}. ${m.line}. ${p.done} of ${p.total} scenes stamped.`}
        className="absolute inset-0 z-[5] rounded-sm focus-visible:outline-2 focus-visible:outline-accent" />
    </article>
  );
}

/** Every collection is a mission. Locked ones (too few check-in places) wait at the end. */
export function CollectionChallenges({ collections }: { collections: ChallengeCollection[] }) {
  const { visited } = usePassport();
  const shown = collections.filter((c) => c.works.length > 0)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(a.c.mission.locked) - Number(b.c.mission.locked) || a.i - b.i)
    .map((x) => x.c);
  if (shown.length === 0) return null;
  const done = shown.filter((c) => visitProgress(c.places.map((x) => x.id), visited).complete).length;

  return (
    <section id="collections" className="mx-auto w-full max-w-screen-xl scroll-mt-16 px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
      <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl">Missions</h1>
      <p className="mt-3 text-ink/70">
        {visited.length === 0 ? "Pick a ticket. Every scene you visit is a stamp." : `${done} of ${shown.length} wrapped. The rest are waiting.`}
      </p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => <li key={c.id} className="min-w-0"><MissionTicket c={c} visited={visited} /></li>)}
      </ul>
    </section>
  );
}
