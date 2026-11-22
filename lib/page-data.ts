// Server data for the public pages, built from the cached live data.
import type { ChallengeCollection } from "@/components/CollectionChallenges";
import { deriveCities, findCityByName, startCity, type City } from "./cities";
import { centreOf } from "./discover";
import { buildCollections, type CollectionModel } from "./collections-model";
import { destinations, type Destination } from "./destinations";
import { getLiveData } from "./live-data";
import { buildNearby, type NearbyResult } from "./nearby";

type NearbyData = { nearby: NearbyResult | null; destinations: Destination[]; cities: City[]; start: City };

/**
 * The list around the default start (the city with the most published places) for Discover and Map,
 * rendered on the server so it shows before any JavaScript. The browser may then move to a better start.
 */
export async function nearbyData(): Promise<NearbyData> {
  try {
    const data = await getLiveData();
    const cities = deriveCities(data.locations);
    const start = startCity(cities);
    return { nearby: buildNearby(data.locations, data.works, start), destinations: destinations(data.locations, cities), cities, start };
  } catch (e) {
    console.error("nearby prerender failed:", e instanceof Error ? e.message : e);
    return { nearby: null, destinations: [], cities: [], start: startCity([]) }; // the browser fetches /api/nearby instead
  }
}

/**
 * Every playable collection for the Collections page: curated, then by city, then by title (each
 * group by size). A trip starts from the collection's city when it is a start city, else from the
 * centre of its places.
 */
export async function collectionsData(): Promise<ChallengeCollection[]> {
  try {
    const data = await getLiveData();
    const cities = deriveCities(data.locations);
    const live = new Set(data.locations.map((l) => l.work_id));
    const order = { curated: 0, city: 1, title: 2 } as const;
    return buildCollections(data)
      .filter((c) => c.places.length > 0)
      .sort((a, b) => order[a.kind] - order[b.kind] || b.places.length - a.places.length || a.name.localeCompare(b.name))
      .map((c) => {
        const centre = centreOf(c.places);
        return {
          id: c.key, href: c.href, kind: c.kind, name: c.name, city: c.city, description: c.description,
          from: findCityByName(cities, c.city)?.id ?? null,
          tripFrom: findCityByName(cities, c.city)?.id ?? (centre ? `${centre.lat},${centre.lng}` : null),
          works: c.works.map((w) => ({ ...w, live: live.has(w.id) })),
          places: c.places.map((p) => ({ id: p.id, checkIn: p.checkIn })),
          cover: c.cover,
        };
      });
  } catch (e) {
    console.error("collections prerender failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Every playable collection: curated plus automatic (by title and by city). */
export async function allCollections(): Promise<CollectionModel[]> {
  try {
    return buildCollections(await getLiveData());
  } catch (e) {
    console.error("collections failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Real counts for the home page: published places, titles with places, collections. */
export async function homeCounts(): Promise<{ places: number; titles: number; collections: number } | null> {
  try {
    const data = await getLiveData();
    const known = new Set(data.works.map((w) => w.id));
    return {
      places: new Set(data.locations.map((l) => l.id)).size,
      titles: new Set(data.locations.map((l) => l.work_id)).size,
      // Same rule as the collections page: a collection shows when it has a known title.
      collections: data.collections.filter((c) => c.work_ids.some((w) => known.has(w))).length,
    };
  } catch {
    return null;
  }
}
