"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CollectionModel } from "@/lib/collections-model";
import { featuredPicks, type ScoreContext } from "@/lib/featured";
import { PhotoCard } from "./PhotoCard";

const KIND = { curated: "Collection", title: "Title", city: "City" } as const;

/** Three collections for this visitor: pinned first, then the best for where they are (lib/featured.ts). */
export function FeaturedCollections({ collections, ctx }: { collections: CollectionModel[]; ctx: ScoreContext }) {
  const shown = useMemo(() => featuredPicks(collections, ctx), [collections, ctx]);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="featured-h" className="mx-auto w-full max-w-screen-xl px-4 py-16 sm:px-8">
      <div className="flex items-end justify-between gap-4">
        <h2 id="featured-h" className="font-display text-3xl tracking-tight sm:text-5xl">Collections</h2>
        <Link href="/collections" className="label inline-flex min-h-11 items-center text-ink/60 transition-colors hover:text-accent">All →</Link>
      </div>
      <ul className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-3">
        {shown.map((c) => (
          <li key={c.key}>
            <PhotoCard href={c.href} title={c.name} photo={c.cover} eyebrow={KIND[c.kind]}
              meta={`${c.city && c.kind !== "city" ? `${c.city} · ` : ""}${c.places.length} places`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
