// Server data for the public pages, built from the cached live data.
import type { ChallengeCollection } from "@/components/CollectionChallenges";
import { deriveCities, findCityByName, startCity, type City } from "./cities";
import { centreOf } from "./discover";
import { buildMapPlaces, type MapPlace } from "./explore-map";
import type { MapCollection } from "@/components/ExploreMap";
import { buildCollections, cardLine, cardName, coverCandidates, type CollectionModel } from "./collections-model";
import { distinctCovers } from "./covers";
import { destinations, type Destination } from "./destinations";
import { getLiveData } from "./live-data";
import { missionInfo } from "./mission";
import { buildNearby, photoOf, type NearbyResult, type Photo } from "./nearby";

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
    const sorted = buildCollections(data)
      .filter((c) => c.places.length > 0 && c.works.length > 0)
      .sort((a, b) => order[a.kind] - order[b.kind] || b.places.length - a.places.length || a.name.localeCompare(b.name));
    // One page shows them all: no Commons file on two cards.
    const covers = distinctCovers(sorted.map(coverCandidates));
    return sorted.map((c, i) => {
        const centre = centreOf(c.places);
        return {
          id: c.key, href: c.href, kind: c.kind, name: cardName(c), line: cardLine(c), city: c.city, description: c.description,
          from: findCityByName(cities, c.city)?.id ?? null,
          tripFrom: findCityByName(cities, c.city)?.id ?? (centre ? `${centre.lat},${centre.lng}` : null),
          works: c.works.map((w) => ({ ...w, live: live.has(w.id) })),
          places: c.places.map((p) => ({ id: p.id, checkIn: p.checkIn })),
          cover: covers[i],
          mission: missionInfo(c.places),
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

/**
 * Home: three different Commons photos for the cards (near me, collections, trips), the most
 * featured collection's cover in the middle, and two real search examples (the title and the
 * city with the most published places).
 */
export async function homeData(): Promise<{ covers: [Photo | null, Photo | null, Photo | null]; strip: Photo[]; examples: string[] }> {
  try {
    const data = await getLiveData();
    const featured = buildCollections(data).filter((c) => c.cover).sort((a, b) => (a.pinRank ?? 99) - (b.pinRank ?? 99))[0]?.cover ?? null;
    const others = [...data.locations].sort((a, b) => a.id - b.id).map(photoOf)
      .filter((p): p is Photo => !!p && p.url !== featured?.url)
      .filter((p, i, all) => all.findIndex((q) => q.url === p.url) === i);
    const top = (xs: (string | null)[]) => {
      const n = new Map<string, number>();
      for (const x of xs) if (x) n.set(x, (n.get(x) ?? 0) + 1);
      return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const titleId = top(data.locations.map((l) => l.work_id));
    const examples = [data.works.find((w) => w.id === titleId)?.title ?? null, top(data.locations.map((l) => l.city))].filter((x): x is string => !!x);
    // Film strip: up to 12 different photos spread over the catalogue.
    const all = featured ? [featured, ...others] : others;
    const stride = Math.max(1, Math.floor(all.length / 12));
    const strip = all.filter((_, i) => i % stride === 0).slice(0, 12);
    return { covers: [others[0] ?? null, featured, others[Math.floor(others.length / 2)] ?? null], strip, examples };
  } catch {
    return { covers: [null, null, null], strip: [], examples: [] };
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

/** Everything the Explore map needs: one marker per published place, collections and start cities. */
export async function mapData(): Promise<{ places: MapPlace[]; collections: MapCollection[]; cities: City[]; start: City; failed: boolean }> {
  try {
    const data = await getLiveData();
    const cities = deriveCities(data.locations);
    return {
      places: buildMapPlaces(data.locations, data.works),
      collections: buildCollections(data).filter((c) => c.places.length > 0)
        .map((c) => ({ key: c.key, name: c.name, placeIds: c.places.map((p) => p.id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      cities, start: startCity(cities), failed: false,
    };
  } catch (e) {
    console.error("map data failed:", e instanceof Error ? e.message : e);
    return { places: [], collections: [], cities: [], start: startCity([]), failed: true };
  }
}
