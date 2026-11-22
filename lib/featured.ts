// Which collections Discover features, per visitor. Pure; runs on the phone because the location
// stays there. Pins set in the admin come first (in rank order), then the best-scoring ones fill
// the rest. No collection is named in code.
import type { CollectionModel } from "./collections-model";
import { haversineKm } from "./distance";
import type { LatLng } from "./types";

export const FEATURED_COUNT = 3;
export const MIN_PLACES = 3; // to be scored at all
export const NEARBY_DEFAULT_KM = 50; // with a location but no radius chip (Anywhere)

export type ScoreContext = { from: LatLng | null; radiusKm: number | null };
export type Scored = { c: CollectionModel; score: number; nearby: number; playable: number; visual: number };

const share = (n: number, total: number) => (total ? n / total : 0);

/**
 * score = nearby×3 + playable×2 + visual, each 0–1. nearby = places within the radius (50 km on
 * Anywhere) divided by the best count among the candidates. Without a location: playable + visual +
 * size (places ÷ the largest collection). Ties: curated first, then by name.
 */
export function scoreCollections(all: CollectionModel[], ctx: ScoreContext): Scored[] {
  const eligible = all.filter((c) => c.places.length >= MIN_PLACES);
  const km = ctx.radiusKm ?? NEARBY_DEFAULT_KM;
  const near = new Map(eligible.map((c) => [c.key, ctx.from ? c.places.filter((p) => haversineKm(ctx.from!, p) <= km).length : 0]));
  const maxNear = Math.max(0, ...near.values());
  const maxSize = Math.max(0, ...eligible.map((c) => c.places.length));
  return eligible
    .map((c) => {
      const nearby = share(near.get(c.key)!, maxNear);
      const playable = share(c.places.filter((p) => p.checkIn).length, c.places.length);
      const visual = share(c.places.filter((p) => p.photo).length, c.places.length);
      const score = ctx.from ? nearby * 3 + playable * 2 + visual : playable + visual + share(c.places.length, maxSize);
      return { c, score, nearby, playable, visual };
    })
    .sort((a, b) => b.score - a.score || Number(b.c.kind === "curated") - Number(a.c.kind === "curated") || a.c.name.localeCompare(b.c.name));
}

/** Pins from the table (featured_rank), in rank order; a pin with no published places is skipped. */
export function pinned(all: CollectionModel[]): CollectionModel[] {
  return all.filter((c) => c.pinRank != null && c.places.length > 0).sort((a, b) => a.pinRank! - b.pinRank!);
}

/**
 * Pins first, then the best scores. If a title collection qualifies (3+ places) but none made the
 * row, the best-scoring one takes the last slot, so the row always shows at least one title.
 */
export function featuredPicks(all: CollectionModel[], ctx: ScoreContext, count = FEATURED_COUNT): CollectionModel[] {
  const pins = pinned(all).slice(0, count);
  const taken = new Set(pins.map((c) => c.key));
  const scored = scoreCollections(all, ctx).map((s) => s.c);
  const row = [...pins, ...scored.filter((c) => !taken.has(c.key))].slice(0, count);
  const title = scored.find((c) => c.kind === "title");
  if (!title || row.some((c) => c.kind === "title") || row.length === 0) return row;
  return row.length < count ? [...row, title] : [...row.slice(0, -1), title];
}
