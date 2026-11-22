// The Explore map: one marker per published place, filters, and what each marker looks like.
// Pure. No film images anywhere: markers show the place's own Commons photo or plain initials.
import { canCheckIn, haversineKm } from "./distance";
import { photoOf, type LiveLocation, type Photo } from "./nearby";
import type { LatLng, Work } from "./types";

export type MapPlace = {
  id: number; name: string; city: string | null; lat: number; lng: number;
  titles: { id: string; title: string }[];
  photo: Photo | null;
  checkIn: boolean; // false: approximate pin, dashed ring, no check-in
  verifiedBy: "ai" | "team" | null;
};

/** One entry per physical place (catalogue rows come one per place and title). */
export function buildMapPlaces(locations: LiveLocation[], works: Pick<Work, "id" | "title">[]): MapPlace[] {
  const titleOf = new Map(works.map((w) => [w.id, w.title]));
  const byId = new Map<number, MapPlace>();
  for (const l of locations) {
    if (l.lat == null || l.lng == null || !titleOf.has(l.work_id)) continue;
    const p = byId.get(l.id) ?? {
      id: l.id, name: l.name, city: l.city, lat: l.lat, lng: l.lng, titles: [],
      photo: photoOf(l), checkIn: canCheckIn(l), verifiedBy: l.verification_method ?? null,
    };
    if (!p.titles.some((t) => t.id === l.work_id)) p.titles.push({ id: l.work_id, title: titleOf.get(l.work_id)! });
    byId.set(l.id, p);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** "The Grand Budapest Hotel" -> "GB" (articles skipped), "Dark" -> "DA". */
export function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const main = words.filter((w, i) => i > 0 || !/^(the|a|an|der|die|das)$/i.test(w) || words.length === 1);
  if (main.length >= 2) return (main[0][0] + main[1][0]).toUpperCase();
  return (main[0] ?? "?").slice(0, 2).toUpperCase();
}

// Wikimedia serves only these thumbnail widths; any other width answers HTTP 400.
export const THUMB_STEPS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920] as const;

/**
 * A Commons thumbnail at least `width` px wide, snapped to a width Wikimedia serves:
 * ".../thumb/a/ab/File.jpg/960px-File.jpg?utm_source=…" -> ".../120px-File.jpg". Other URLs unchanged.
 */
export function thumbAt(url: string, width: number): string {
  const base = url.split("?")[0];
  const step = THUMB_STEPS.find((s) => s >= width) ?? THUMB_STEPS[THUMB_STEPS.length - 1];
  if (/\/thumb\/.+\/\d+px-[^/]+$/.test(base)) return base.replace(/\/(\d+)px-([^/]+)$/, `/${step}px-$2`);
  // A small original (Commons gave no thumbnail): build one, only for small sizes so it never upscales.
  const orig = base.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+\.(?:jpe?g|png|webp))$/i);
  if (orig && step <= 250) return `${orig[1]}/thumb/${orig[2]}/${orig[3]}/${orig[4]}/${step}px-${orig[4]}`;
  return url;
}

export type MapFilters = {
  title: string | null; // highlights; others fade
  collection: { placeIds: number[] } | null; // hides places outside it
  city: string | null; // hides places in other cities
  radiusKm: number | null; // hides places farther from the origin
};

export type MarkerState = { place: MapPlace; highlighted: boolean; faded: boolean };

/** Which places show, and how: collection, city and radius hide; a title highlights (the rest fade to 35%). */
export function applyFilters(places: MapPlace[], f: MapFilters, origin: LatLng | null): MarkerState[] {
  const inCollection = f.collection ? new Set(f.collection.placeIds) : null;
  return places
    .filter((p) => !inCollection || inCollection.has(p.id))
    .filter((p) => !f.city || p.city === f.city)
    .filter((p) => f.radiusKm === null || !origin || haversineKm(origin, p) <= f.radiusKm)
    .map((p) => {
      const match = !!f.title && p.titles.some((t) => t.id === f.title);
      return { place: p, highlighted: match, faded: !!f.title && !match };
    });
}

export const markerLabel = (p: MapPlace) => `${p.name} — ${p.titles.map((t) => t.title).join(", ")}`;
