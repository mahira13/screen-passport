import type { Metadata } from "next";
import Link from "next/link";
import { ExploreMap } from "@/components/ExploreMap";
import { mapData } from "@/lib/page-data";

export const metadata: Metadata = { title: "Map · Screen Passport" };

export default async function MapPage() {
  const { places, collections, cities, start, failed } = await mapData();
  if (failed) {
    return (
      <main className="mx-auto max-w-screen-md px-4 py-24 text-center">
        <p className="font-serif text-3xl italic text-ink/70">The map didn&apos;t load. It may be a connection problem.</p>
        <Link href="/map" className="label mt-6 inline-flex min-h-11 items-center bg-accent px-5 text-paper">Try again</Link>
      </main>
    );
  }
  return (
    <main className="w-full">
      <h1 className="sr-only">Map of filming places</h1>
      <ExploreMap places={places} collections={collections} cities={cities} start={start} />
    </main>
  );
}
