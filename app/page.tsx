import { CollectionChallenges, type ChallengeCollection } from "@/components/CollectionChallenges";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { DEFAULT_CITY } from "@/lib/cities";
import { destinations, type Destination } from "@/lib/destinations";
import { getLiveData } from "@/lib/live-data";
import { buildNearby, type NearbyResult } from "@/lib/nearby";

type Initial = { nearby: NearbyResult | null; destinations: Destination[]; collections: ChallengeCollection[] };

// The Berlin list is rendered on the server from cached data, so it shows
// before any JavaScript runs. The map loads after it.
async function initialData(): Promise<Initial> {
  try {
    const data = await getLiveData();
    const live = new Set(data.locations.map((l) => l.work_id));
    const titleOf = new Map(data.works.map((w) => [w.id, w.title]));
    return {
      nearby: buildNearby(data.locations, data.works, DEFAULT_CITY),
      destinations: destinations(data.locations),
      collections: data.collections.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        description: c.description,
        works: [...new Set(c.work_ids)].flatMap((id) => {
          const title = titleOf.get(id);
          return title ? [{ id, title, live: live.has(id) }] : [];
        }),
      })),
    };
  } catch (e) {
    console.error("nearby prerender failed:", e instanceof Error ? e.message : e);
    return { nearby: null, destinations: [], collections: [] }; // the browser fetches /api/nearby instead
  }
}

export default async function Home() {
  const initial = await initialData();
  return (
    <main className="w-full">
      <NearbyExplorer initial={initial.nearby} destinations={initial.destinations} />
      <CollectionChallenges collections={initial.collections} />
    </main>
  );
}
