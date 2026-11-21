import { NearbyExplorer } from "@/components/NearbyExplorer";
import { DEFAULT_CITY } from "@/lib/cities";
import { getLiveData } from "@/lib/live-data";
import { buildNearby, type NearbyResult } from "@/lib/nearby";

// The Berlin list is rendered on the server from cached data, so it shows
// before any JavaScript runs. The map loads after it.
async function initialNearby(): Promise<NearbyResult | null> {
  try {
    const data = await getLiveData();
    return buildNearby(data.locations, data.works, DEFAULT_CITY);
  } catch (e) {
    console.error("nearby prerender failed:", e instanceof Error ? e.message : e);
    return null; // the browser fetches /api/nearby instead
  }
}

export default async function Home() {
  const initial = await initialNearby();
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-6">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Screen Passport</h1>
        <p className="mt-1 text-base text-navy/80">Films and series shot near you. Visit them, stamp them, share them.</p>
      </header>
      <NearbyExplorer initial={initial} />
    </main>
  );
}
