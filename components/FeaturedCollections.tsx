"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cardLine, cardName, coverCandidates, type CollectionModel } from "@/lib/collections-model";
import { distinctCovers } from "@/lib/covers";
import type { Photo } from "@/lib/nearby";
import { featuredPicks, type ScoreContext } from "@/lib/featured";
import { PhotoCard } from "./PhotoCard";

const KIND = { curated: "Collection", title: "Title", city: "City" } as const;

/** Three collections for this visitor: pinned first, then the best for where they are (lib/featured.ts). */
export function FeaturedCollections({ collections, ctx, avoid = [] }: { collections: CollectionModel[]; ctx: ScoreContext; avoid?: Photo[] }) {
  const shown = useMemo(() => featuredPicks(collections, ctx), [collections, ctx]);
  const covers = distinctCovers(shown.map(coverCandidates), avoid);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="featured-h" className="mx-auto w-full max-w-screen-xl px-4 py-16 sm:px-8">
      <div className="flex items-end justify-between gap-4">
        <h2 id="featured-h" className="font-display text-3xl tracking-tight sm:text-5xl">Collections</h2>
        <Link href="/collections" className="label inline-flex min-h-11 items-center text-ink/60 transition-colors hover:text-accent">All →</Link>
      </div>
      <ul className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-3">
        {shown.map((c, i) => (
          <li key={c.key}>
            <PhotoCard href={c.href} title={cardName(c)} photo={covers[i]} eyebrow={KIND[c.kind]} overlay
              meta={<p className="truncate">{cardLine(c)}</p>} />
          </li>
        ))}
      </ul>
    </section>
  );
}
