"use client";

import { track } from "@/lib/analytics";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";

export function DirectionsLink({ place }: { place: Pick<NearbyPlace, "id" | "lat" | "lng"> }) {
  return (
    <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer"
      onClick={() => track("directions_clicked", { location: place.id })}
      className="label inline-flex min-h-11 items-center justify-center bg-accent px-3.5 text-paper transition-colors hover:bg-ink">
      Directions
    </a>
  );
}
