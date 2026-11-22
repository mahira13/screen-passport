"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CollectionModel } from "@/lib/collections-model";
import { featuredPicks, type ScoreContext } from "@/lib/featured";
import { PhotoCredit } from "./PlacePhoto";
import { ScenePlate } from "./ScenePlate";

const KIND = { curated: "Collection", title: "Title", city: "City" } as const;

/** Three collections for this visitor: pinned first, then the best for where they are (lib/featured.ts). */
export function FeaturedCollections({ collections, ctx }: { collections: CollectionModel[]; ctx: ScoreContext }) {
  const shown = useMemo(() => featuredPicks(collections, ctx), [collections, ctx]);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="featured-h" className="relative overflow-hidden border-t border-ink/10 py-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[26rem] w-[26rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label text-accent">02 — Featured collections</p>
            <h2 id="featured-h" className="mt-3 font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Cinematic <span className="text-accent">adventures.</span>
            </h2>
          </div>
          <Link href="/collections" className="label inline-flex min-h-11 items-center text-ink/70 transition-colors hover:text-accent">
            All collections →
          </Link>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {shown.map((c, i) => {
            const playable = c.places.filter((p) => p.checkIn).length;
            return (
              <li key={c.key}>
                <Link href={c.href} className="group block transition-transform duration-500 hover:-translate-y-1">
                  <ScenePlate index={i + 1} className="aspect-[16/10]">
                    {c.cover && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.cover.url} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
                        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f182b] via-[#0f182b]/40 to-transparent" />
                      </>
                    )}
                    <p className="label text-ink/75">{KIND[c.kind]}{c.city && c.kind !== "city" ? ` · ${c.city}` : ""} · {c.places.length} places</p>
                    <p className="mt-1 font-display text-3xl leading-[0.95] text-ink transition-colors group-hover:text-accent sm:text-4xl">{c.name}</p>
                    <p className="label mt-2 text-ink/65">{playable} with check-in</p>
                  </ScenePlate>
                </Link>
                {c.cover && <PhotoCredit photo={c.cover} />}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
