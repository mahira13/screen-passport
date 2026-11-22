// Discover: radius chips, empty states, popular titles and search-result centres. Pure functions.
import { haversineKm } from "./distance";
import type { LatLng } from "./types";

/** Radius chips in km; null is "Anywhere". */
export const RADII = [5, 10, 25, 50, null] as const;
export type Radius = (typeof RADII)[number];

export const radiusLabel = (r: Radius) => (r === null ? "Anywhere" : `${r} km`);

/** "25" -> 25; anything that isn't a chip -> null (Anywhere). */
export function parseRadius(raw: string | null | undefined): Radius {
  const n = Number(raw);
  return (RADII.find((r) => r !== null && r === n) ?? null) as Radius;
}

/** The next wider chip, or null when already at Anywhere. */
export function widerRadius(r: Radius): Radius | undefined {
  if (r === null) return undefined;
  return RADII[RADII.indexOf(r) + 1];
}

/** Fewest places an automatic radius must show. */
export const AUTO_MIN_PLACES = 3;

/**
 * After location is granted: the smallest chip (5, 10, 25, 50 km) with at least 3 published places
 * (each place once, even when several titles were filmed there); otherwise Anywhere.
 */
export function autoRadius(places: { id: number; distanceKm: number }[]): Radius {
  for (const r of RADII) {
    if (r === null) break;
    if (new Set(places.filter((p) => p.distanceKm <= r).map((p) => p.id)).size >= AUTO_MIN_PLACES) return r;
  }
  return null;
}

/** "No verified locations within 10 km. Try 25 km or explore a collection." */
export function emptyMessage(r: Radius): string {
  if (r === null) return "No verified locations yet. Explore a collection while we add more.";
  const wider = widerRadius(r);
  const next = wider === null ? "searching anywhere" : radiusLabel(wider!);
  return `No verified locations within ${radiusLabel(r)}. Try ${next} or explore a collection.`;
}

/** Fallback when nearby_locations isn't available: same straight-line rule in code. */
export function withinRadius<T extends LatLng>(items: T[], from: LatLng, r: Radius): T[] {
  return r === null ? items : items.filter((i) => haversineKm(from, i) <= r);
}

/** A search_catalogue result; cities and countries carry a centre to start from. */
export type SearchHit = { kind: "work" | "city" | "country"; id: string; label: string; places: number; centre: LatLng | null };

export type PopularTitle = { workId: string; title: string; type: string; passports: number; places: number };

/**
 * Titles ranked by how many passports marked them watched (real counts), then by places.
 * Only titles with published places; titles nobody has marked yet come last, ranked by places.
 */
export function popularTitles(
  watchedLists: string[][],
  works: { id: string; title: string; type: string }[],
  placesByWork: Map<string, number>,
  limit = 8,
): PopularTitle[] {
  const counts = new Map<string, number>();
  for (const list of watchedLists) for (const id of new Set(list)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return works
    .filter((w) => (placesByWork.get(w.id) ?? 0) > 0)
    .map((w) => ({ workId: w.id, title: w.title, type: w.type, passports: counts.get(w.id) ?? 0, places: placesByWork.get(w.id)! }))
    .sort((a, b) => b.passports - a.passports || b.places - a.places || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Centre of a set of points (fine for a city or a country's places; not across the antimeridian). */
export function centreOf(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}

