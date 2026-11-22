"use client";

import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/discover";
import { CatalogueSearch } from "./CatalogueSearch";

/** Home search: a title opens its page, a city or country opens Discover around it. */
export function HomeSearch({ examples }: { examples: string[] }) {
  const router = useRouter();
  const pick = (h: SearchHit) => {
    if (h.kind === "work") return router.push(`/title/${encodeURIComponent(h.id)}`);
    if (h.centre) router.push(`/discover?${new URLSearchParams({ at: `${h.centre.lat},${h.centre.lng}`, label: h.label, kind: h.kind })}`);
  };
  return <CatalogueSearch onPick={pick} examples={examples} />;
}
