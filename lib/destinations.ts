import { CITIES } from "./cities";
import type { LiveLocation } from "./nearby";

export interface Destination {
  city: string;
  cityId: string | null; // set when the city is one of the start cities
  places: number;
  titles: number;
}

const fold = (s: string) => s.toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[^a-z]/g, "");

const START = new Map(CITIES.flatMap((c) => [[fold(c.name), c.id], [fold(c.id), c.id]]));

/** Cities with the most live filming places, from real rows only. */
export function destinations(locations: LiveLocation[], limit = 8): Destination[] {
  const byCity = new Map<string, { city: string; places: number; works: Set<string> }>();
  for (const l of locations) {
    const city = l.city?.trim();
    if (!city) continue;
    const key = fold(city);
    const d = byCity.get(key) ?? { city, places: 0, works: new Set<string>() };
    d.places++;
    d.works.add(l.work_id);
    byCity.set(key, d);
  }
  return [...byCity.entries()]
    .map(([key, d]) => ({ city: d.city, cityId: START.get(key) ?? null, places: d.places, titles: d.works.size }))
    .sort((a, b) => b.places - a.places || a.city.localeCompare(b.city))
    .slice(0, limit);
}
