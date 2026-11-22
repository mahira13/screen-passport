// Server data for the public pages, built from the cached live data.
import type { ChallengeCollection } from "@/components/CollectionChallenges";
import { deriveCities, findCityByName, startCity, type City } from "./cities";
import { buildCollections, type CollectionModel } from "./collections-model";
import { destinations, type Destination } from "./destinations";
import { getLiveData } from "./live-data";
import { buildNearby, coverPhoto, type NearbyResult } from "./nearby";
import { checkInIds } from "./passport";

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

export async function collectionsData(): Promise<ChallengeCollection[]> {
  try {
    const data = await getLiveData();
    const live = new Set(data.locations.map((l) => l.work_id));
    const titleOf = new Map(data.works.map((w) => [w.id, w.title]));
    const precise = checkInIds(data.locations);
    const cities = deriveCities(data.locations);
    return data.collections.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      from: findCityByName(cities, c.city)?.id ?? null,
      description: c.description,
      works: [...new Set(c.work_ids)].flatMap((id) => {
        const title = titleOf.get(id);
        return title ? [{ id, title, live: live.has(id) }] : [];
      }),
      // Each physical place once, even when it was filmed for several of these titles.
      places: [...new Set(data.locations.filter((l) => c.work_ids.includes(l.work_id)).map((l) => l.id))]
        .map((id) => ({ id, checkIn: precise.has(id) })),
      cover: coverPhoto(c.work_ids, data.locations),
    }));
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
