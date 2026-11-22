// Server data for the public pages, built from the cached live data.
import type { ChallengeCollection } from "@/components/CollectionChallenges";
import { DEFAULT_CITY } from "./cities";
import { buildCollections, type CollectionModel } from "./collections-model";
import { destinations, type Destination } from "./destinations";
import { getLiveData } from "./live-data";
import { buildNearby, coverPhoto, type NearbyResult } from "./nearby";
import { checkInIds } from "./passport";

/** The Berlin list for Discover and Map, rendered on the server so it shows before any JavaScript. */
export async function nearbyData(): Promise<{ nearby: NearbyResult | null; destinations: Destination[] }> {
  try {
    const data = await getLiveData();
    return { nearby: buildNearby(data.locations, data.works, DEFAULT_CITY), destinations: destinations(data.locations) };
  } catch (e) {
    console.error("nearby prerender failed:", e instanceof Error ? e.message : e);
    return { nearby: null, destinations: [] }; // the browser fetches /api/nearby instead
  }
}

export async function collectionsData(): Promise<ChallengeCollection[]> {
  try {
    const data = await getLiveData();
    const live = new Set(data.locations.map((l) => l.work_id));
    const titleOf = new Map(data.works.map((w) => [w.id, w.title]));
    const precise = checkInIds(data.locations);
    return data.collections.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
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
