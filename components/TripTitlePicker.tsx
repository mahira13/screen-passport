"use client";

import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/discover";
import { CatalogueSearch } from "./CatalogueSearch";

/** Create a trip without a title yet: pick one (a city sets the start instead). */
export function TripTitlePicker({ examples }: { examples: string[] }) {
  const router = useRouter();
  const pick = (h: SearchHit) => {
    if (h.kind === "work") return router.push(`/trip/new?works=${encodeURIComponent(h.id)}`);
    if (h.centre) router.push(`/discover?${new URLSearchParams({ at: `${h.centre.lat},${h.centre.lng}`, label: h.label, kind: h.kind })}`);
  };
  return <CatalogueSearch onPick={pick} examples={examples} />;
}
