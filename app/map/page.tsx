import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { nearbyData } from "@/lib/page-data";

export const metadata: Metadata = { title: "Map · Screen Passport" };

export default async function MapPage() {
  const { nearby, destinations, cities, start } = await nearbyData();
  return (
    <main className="w-full">
      <NearbyExplorer initial={nearby} cities={cities} start={start} destinations={destinations} view="map" />
    </main>
  );
}
