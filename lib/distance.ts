import type { CoordQuality, LatLng } from "./types";

const EARTH_RADIUS_KM = 6371.0088;

/** Straight-line (great-circle) distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BandKey = "near" | "day" | "weekend" | "big";

export const BANDS: { key: BandKey; label: string; maxKm: number }[] = [
  { key: "near", label: "Near you", maxKm: 2 },
  { key: "day", label: "Day trip", maxKm: 30 },
  { key: "weekend", label: "Weekend by train", maxKm: 250 },
  { key: "big", label: "Big trip", maxKm: Infinity },
];

/** Bands are [lower, upper): exactly 2 km is a day trip. */
export function distanceBand(km: number) {
  return BANDS.find((b) => km < b.maxKm) ?? BANDS[BANDS.length - 1];
}

/** "about 0.3 km", "about 12 km". */
export function formatDistance(km: number): string {
  const value = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return `about ${value} km`;
}

/** Adds distanceKm, drops items without coordinates, sorts closest first. */
export function sortByDistance<T extends { lat: number | null; lng: number | null }>(
  items: T[],
  from: LatLng,
): (T & { distanceKm: number })[] {
  return items
    .filter((i): i is T & LatLng => i.lat !== null && i.lng !== null)
    .map((i) => ({ ...i, distanceKm: haversineKm(from, i) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export const CHECKIN_RADIUS_KM = 0.2;

export function isWithinCheckIn(user: LatLng, place: LatLng): boolean {
  return haversineKm(user, place) <= CHECKIN_RADIUS_KM;
}

/**
 * Check-in is only offered where coordinates are exact enough for 200 m:
 * taken from the source or checked by a human. Geocoded and approximate
 * points can be kilometres off.
 */
export function canCheckIn(loc: { lat: number | null; lng: number | null; coord_quality: CoordQuality | null }): boolean {
  return loc.lat !== null && loc.lng !== null && (loc.coord_quality === "source" || loc.coord_quality === "verified");
}

/** Parses form input; null unless both are valid numbers in range. */
export function parseLatLng(lat: unknown, lng: unknown): LatLng | null {
  const toNum = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const a = toNum(lat);
  const b = toNum(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}
