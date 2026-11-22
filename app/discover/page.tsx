import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { popularData } from "@/lib/discover-server";
import { allCollections, nearbyData } from "@/lib/page-data";

export const metadata: Metadata = { title: "Discover · Screen Passport" };

export default async function DiscoverPage() {
  const [{ nearby, destinations }, collections, popular] = await Promise.all([nearbyData(), allCollections(), popularData()]);
  return (
    <main className="w-full">
      <NearbyExplorer initial={nearby} destinations={destinations} popular={popular} featured={collections} />
    </main>
  );
}
