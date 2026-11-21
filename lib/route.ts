import { haversineKm } from "./distance";
import type { LatLng } from "./types";

export const MAX_WAYPOINTS = 9; // Google Maps URLs limit

/**
 * Greedy tour: from the start, always go to the closest stop not yet visited.
 * Adds kmFromPrevious (straight line, from the start for the first stop).
 * Ties keep input order, so the result is stable.
 */
export function orderNearestNext<T extends LatLng>(start: LatLng, points: T[]): (T & { kmFromPrevious: number })[] {
  const left = [...points];
  const out: (T & { kmFromPrevious: number })[] = [];
  let here = start;
  while (left.length) {
    let best = 0;
    let bestKm = haversineKm(here, left[0]);
    for (let i = 1; i < left.length; i++) {
      const km = haversineKm(here, left[i]);
      if (km < bestKm) [best, bestKm] = [i, km];
    }
    const [next] = left.splice(best, 1);
    out.push({ ...next, kmFromPrevious: bestKm });
    here = next;
  }
  return out;
}

/** Sum of the legs between stops (getting to the first stop not included). */
export function kmBetweenStops(stops: { kmFromPrevious: number }[]): number {
  return stops.slice(1).reduce((sum, s) => sum + s.kmFromPrevious, 0);
}

export type TravelMode = "walk" | "transit" | "car";

const GOOGLE_MODE: Record<TravelMode, string | null> = {
  walk: "walking",
  car: "driving",
  transit: null, // Google Maps doesn't take waypoints with transit; let the user pick the mode there
};

/**
 * One Google Maps link through all stops (official Maps URLs format, no API key).
 * No origin, so Google starts from where the phone is. The last stop is the
 * destination, the others are waypoints (at most 9, so at most 10 stops).
 */
export function googleMapsRouteUrl(stops: LatLng[], mode: TravelMode): string | null {
  if (stops.length === 0) return null;
  const pts = stops.slice(0, MAX_WAYPOINTS + 1).map((s) => `${s.lat},${s.lng}`);
  const params = new URLSearchParams({ api: "1", destination: pts[pts.length - 1] });
  if (pts.length > 1) params.set("waypoints", pts.slice(0, -1).join("|"));
  const travel = GOOGLE_MODE[mode];
  if (travel) params.set("travelmode", travel);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
