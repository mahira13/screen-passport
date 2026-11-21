import { formatDistance } from "@/lib/distance";
import type { NearbyTitle } from "@/lib/nearby";

export function TitleCard({ title: t }: { title: NearbyTitle }) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy/10">
      <p className="text-xs uppercase tracking-wide text-navy/60">{t.type === "series" ? "Series" : "Film"}</p>
      <h3 className="font-display text-lg font-semibold leading-tight">{t.title}</h3>
      <p className="mt-1 text-sm">
        {t.placeCount} {t.placeCount === 1 ? "place" : "places"}
        <span className="text-navy/60"> · closest: </span>
        {t.closest.name}, {formatDistance(t.closest.distanceKm)}
      </p>
    </article>
  );
}
