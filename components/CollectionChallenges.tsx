"use client";

import Link from "next/link";
import { findCityByName } from "@/lib/cities";
import { collectionProgress } from "@/lib/collections";
import { toggleWatched } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";
import { ScenePlate } from "./ScenePlate";

export type ChallengeCollection = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  works: { id: string; title: string; live: boolean }[]; // live: has places on the map
};

function Challenge({ c, n, watched, big, wide }: { c: ChallengeCollection; n: number; watched: string[]; big: boolean; wide: boolean }) {
  const p = collectionProgress({ id: c.id, name: c.name, city: c.city, work_ids: c.works.map((w) => w.id), description: null }, watched);
  const seen = new Set(watched);
  const city = findCityByName(c.city);
  const live = c.works.filter((w) => w.live).map((w) => w.id);
  const tripHref = live.length ? `/trip/new?works=${encodeURIComponent(live.slice(0, 10).join(","))}&from=${city?.id ?? "berlin"}` : null;

  return (
    <article className={`relative h-full bg-surface ${wide ? "md:grid md:grid-cols-2" : "flex flex-col"}`}>
      <ScenePlate index={n + 1} className={big ? "aspect-[4/3] sm:aspect-[16/9]" : wide ? "aspect-[2.39/1] md:aspect-auto md:min-h-full" : "aspect-[2.39/1]"}>
        <p className="label text-ink/75">Challenge {String(n + 1).padStart(2, "0")}{c.city && ` · ${c.city}`}</p>
        <h3 className={`mt-1 font-serif leading-[0.9] tracking-tight text-ink ${big ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"}`}>
          {c.name}
        </h3>
      </ScenePlate>

      {p.complete && (
        <span aria-label="Collection complete"
          className="absolute right-4 top-4 z-10 flex h-24 w-24 rotate-[-12deg] flex-col items-center justify-center rounded-full border-[3px] border-double border-accent bg-paper/80 text-center text-accent backdrop-blur-sm">
          <span className="font-condensed text-xl leading-none tracking-widest">Complete</span>
          <span className="font-serif text-xs italic">{p.total}/{p.total}</span>
        </span>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {c.description && <p className="font-serif text-xl italic leading-snug text-ink/80">{c.description}</p>}

        <div className="mt-5" role="img" aria-label={`${p.done} of ${p.total} watched`}>
          <div className="flex items-baseline justify-between">
            <span className="label text-ink/60">Your progress</span>
            <span className="font-condensed text-3xl leading-none text-accent">{p.done}<span className="text-ink/60">/{p.total}</span></span>
          </div>
          <div className="mt-2 flex gap-1">
            {c.works.map((w) => (
              <span key={w.id} className={`h-1.5 flex-1 ${seen.has(w.id) ? "bg-accent" : "bg-ink/15"}`} />
            ))}
          </div>
        </div>

        <ul className="mt-5 divide-y divide-ink/10">
          {c.works.map((w) => {
            const on = seen.has(w.id);
            return (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className={`font-serif text-lg ${on ? "text-ink" : "text-ink/70"}`}>{w.title}</span>
                {w.live ? (
                  <button type="button" aria-pressed={on} onClick={() => toggleWatched(w.id, city?.id ?? null)}
                    aria-label={`${on ? "Watched" : "Mark as watched"}: ${w.title}`}
                    className={`label shrink-0 px-3 transition-colors ${on ? "bg-accent text-paper" : "border border-ink/25 text-ink/70 hover:border-accent hover:text-accent"}`}>
                    {on ? "✓ Watched" : "+ Watched"}
                  </button>
                ) : (
                  <span className="label shrink-0 text-ink/60">Places coming</span>
                )}
              </li>
            );
          })}
        </ul>

        {tripHref && (
          <Link href={tripHref} className="label mt-auto inline-flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 pt-4 text-accent hover:text-ink">
            Turn it into a trip <span aria-hidden className="text-lg">→</span>
          </Link>
        )}
      </div>
    </article>
  );
}

// Layout: one large cover, two beside it, then the rest share a row.
const REST_SPAN: Record<number, string> = { 1: "lg:col-span-12", 2: "lg:col-span-6", 3: "lg:col-span-4" };

/** Collections as small cinematic adventures. Progress comes from the titles marked as watched. */
export function CollectionChallenges({ collections }: { collections: ChallengeCollection[] }) {
  const { watched } = usePassport();
  const shown = collections.filter((c) => c.works.length > 0);
  if (shown.length === 0) return null;
  const done = shown.filter((c) => collectionProgress({ ...c, work_ids: c.works.map((w) => w.id) }, watched).complete).length;

  return (
    <section id="collections" className="relative scroll-mt-16 overflow-hidden border-t border-ink/10 py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-20 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label text-accent">03 — Collect</p>
            <h2 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Cinematic <span className="italic text-accent">challenges.</span>
            </h2>
            <p className="mt-4 max-w-lg text-ink/70">
              Each collection is a small adventure through one city&apos;s films. Watch them, visit the places, complete the set.
            </p>
          </div>
          {watched.length > 0 && (
            <p className="label text-ink/60">
              <span className="font-condensed text-4xl tracking-normal text-ink">{done}</span> of {shown.length} complete
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          {shown.map((c, i) => (
            <div key={c.id} className={i === 0 ? "lg:col-span-7 lg:row-span-2" : i < 3 ? "lg:col-span-5" : REST_SPAN[Math.min(shown.length - 3, 3)]}>
              <Challenge c={c} n={i} watched={watched} big={i === 0} wide={i >= 3 && shown.length === 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
