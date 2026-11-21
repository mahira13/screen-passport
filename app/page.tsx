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
    <main className="w-full pb-28">
      <section className="mx-auto w-full max-w-screen-2xl px-4 pb-6 pt-4 sm:px-8 lg:px-12">
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Films and series shot near you.
        </h1>
        <p className="mt-3 text-lg text-ink/70 sm:text-xl">Visit them, stamp them, share them.</p>
      </section>
      <NearbyExplorer initial={initial} />
    </main>
  );
}
