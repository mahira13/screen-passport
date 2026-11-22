import { cityKey, type City } from "./cities";
import type { LiveLocation } from "./nearby";

export interface Destination {
  city: string;
  cityId: string | null; // set when the city is one of the start cities
  places: number;
  titles: number;
}

/** Cities with the most live filming places, from real rows only. */
export function destinations(locations: LiveLocation[], cities: City[], limit = 8): Destination[] {
  const start = new Map(cities.map((c) => [cityKey(c.name), c.id]));
  const byCity = new Map<string, { city: string; places: number; works: Set<string> }>();
  for (const l of locations) {
    const city = l.city?.trim();
    if (!city) continue;
    const key = cityKey(city);
    const d = byCity.get(key) ?? { city, places: 0, works: new Set<string>() };
    d.places++;
    d.works.add(l.work_id);
    byCity.set(key, d);
  }
  return [...byCity.entries()]
    .map(([key, d]) => ({ city: d.city, cityId: start.get(key) ?? null, places: d.places, titles: d.works.size }))
    .sort((a, b) => b.places - a.places || a.city.localeCompare(b.city))
    .slice(0, limit);
}
