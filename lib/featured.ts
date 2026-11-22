// Which collections Discover features, per visitor. Pure; runs on the phone because the location
// stays there. Pinned collections first (in rank order), then the best-scoring ones fill the rest.
import type { CollectionModel } from "./collections-model";
import { haversineKm } from "./distance";
import type { LatLng } from "./types";

export const FEATURED_COUNT = 3;
export const MIN_PLACES = 3; // to be scored at all
export const NEARBY_DEFAULT_KM = 50; // with a location but no radius chip (Anywhere)

/**
 * Pins set in code by a rule, not by hand: the first collection in keys that exists gets the rank
 * once enough of its places are check-in grade. Dark in Germany (curated, once written) or, until
 * then, the automatic Dark collection.
 */
export type PinRule = { keys: string[]; rank: number; minCheckIn: number };
export const PIN_RULES: PinRule[] = [{ keys: ["curated:dark-in-germany", "title:dark"], rank: 1, minCheckIn: 5 }];

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

/** Pins in order: rule pins and table pins by rank (a rule pin wins a tie), each collection once. */
export function pinned(all: CollectionModel[], rules: PinRule[] = PIN_RULES): CollectionModel[] {
  const byKey = new Map(all.map((c) => [c.key, c]));
  const fromRules = rules.flatMap((r) => {
    const c = r.keys.map((k) => byKey.get(k)).find(Boolean);
    return c && c.places.filter((p) => p.checkIn).length >= r.minCheckIn ? [{ c, rank: r.rank, rule: 0 }] : [];
  });
  const fromTable = all.filter((c) => c.pinRank != null && c.places.length > 0).map((c) => ({ c, rank: c.pinRank!, rule: 1 }));
  const seen = new Set<string>();
  return [...fromRules, ...fromTable]
    .sort((a, b) => a.rank - b.rank || a.rule - b.rule)
    .filter(({ c }) => !seen.has(c.key) && seen.add(c.key))
    .map(({ c }) => c);
}

export function featuredPicks(all: CollectionModel[], ctx: ScoreContext, count = FEATURED_COUNT, rules: PinRule[] = PIN_RULES): CollectionModel[] {
  const pins = pinned(all, rules).slice(0, count);
  const taken = new Set(pins.map((c) => c.key));
  const rest = scoreCollections(all, ctx).map((s) => s.c).filter((c) => !taken.has(c.key));
  return [...pins, ...rest].slice(0, count);
}
