// Start cities, built from published places: every city with enough of them. Nothing is listed by
// hand, so a new film town appears as soon as its places are published. Pure.
import { slugify } from "./collections-model";
import { centreOf } from "./discover";
import { haversineKm } from "./distance";
import { inRegion, REGION, tzForCountry } from "./region";
import type { LatLng } from "./types";

export interface City extends LatLng {
  id: string; // slug of the name: "Görlitz" -> "goerlitz"
  name: string;
  tz: string; // IANA time zone, used for trip times
  places: number; // distinct published places
}

export const MIN_CITY_PLACES = 3;

/**
 * Matching key for a city name, the same rule as search_norm() in SQL: "Görlitz", "Goerlitz" and
 * "Gorlitz" are one city. Not shown anywhere; ids stay readable slugs.
 */
export const cityKey = (name: string) =>
  name.toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u").replace(/[^a-z0-9]+/g, "");

type Row = { id: number; city: string | null; lat: number | null; lng: number | null; country_code?: string | null };

/** Cities with at least MIN_CITY_PLACES distinct published places, most places first. */
export function deriveCities(rows: Row[], min = MIN_CITY_PLACES): City[] {
  const groups = new Map<string, { names: Map<string, number>; places: Map<number, LatLng>; country: string | null }>();
  for (const r of rows) {
    const name = r.city?.trim();
    if (!name || r.lat == null || r.lng == null) continue;
    const key = cityKey(name);
    if (!key) continue;
    const g = groups.get(key) ?? { names: new Map(), places: new Map(), country: r.country_code ?? null };
    if (!g.places.has(r.id)) g.names.set(name, (g.names.get(name) ?? 0) + 1);
    g.places.set(r.id, { lat: r.lat, lng: r.lng });
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.places.size >= min)
    .map((g) => {
      const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]; // the most used spelling
      return { id: slugify(name), name, tz: tzForCountry(g.country), places: g.places.size, ...centreOf([...g.places.values()])! };
    })
    .sort((a, b) => b.places - a.places || a.name.localeCompare(b.name));
}

export const findCity = (cities: City[], id: string | null | undefined) => (id ? cities.find((c) => c.id === id) : undefined);

/** "Görlitz", "goerlitz" or "GÖRLITZ" -> that city, if it is one. */
export function findCityByName(cities: City[], name: string | null | undefined): City | undefined {
  const key = name ? cityKey(name) : "";
  return key ? cities.find((c) => cityKey(c.name) === key) : undefined;
}

/** The city with the most published places: the start when we know nothing about the visitor. */
export const defaultCity = (cities: City[]): City | null => cities[0] ?? null;

export function nearestCity(cities: City[], p: LatLng): City | null {
  let best: City | null = null;
  let bestKm = Infinity;
  for (const c of cities) {
    const km = haversineKm(p, c);
    if (km < bestKm) [best, bestKm] = [c, km];
  }
  return best;
}

export type StartHint = { country?: string | null; lat?: string | null; lng?: string | null };

/**
 * Where to start from the hosting provider's IP location headers. A hint only: never stored,
 * never used for check-in. Inside the region: the nearest city; otherwise the default.
 */
export function startFromHint(cities: City[], hint: StartHint): { city: City | null; source: "ip" | "default" } {
  const lat = Number(hint.lat);
  const lng = Number(hint.lng);
  const usable = inRegion(hint.country) && hint.lat && hint.lng && Number.isFinite(lat) && Number.isFinite(lng);
  const near = usable ? nearestCity(cities, { lat, lng }) : null;
  return near ? { city: near, source: "ip" } : { city: defaultCity(cities), source: "default" };
}

/** The default city, or the whole region (its centre) when nothing is published yet. */
export function startCity(cities: City[]): City {
  return defaultCity(cities) ?? { id: slugify(REGION.country), name: REGION.country, tz: REGION.tz, places: 0, ...REGION.centre };
}
