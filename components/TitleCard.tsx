import { formatDistance } from "@/lib/distance";
import type { NearbyTitle } from "@/lib/nearby";

type Props = { title: NearbyTitle; watched: boolean; onToggle: () => void };

export function TitleCard({ title: t, watched, onToggle }: Props) {
  return (
    <article className={`flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ${watched ? "ring-2 ring-gold" : "ring-navy/10"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-navy/60">{t.type === "series" ? "Series" : "Film"}</p>
        <h3 className="font-display text-lg font-semibold leading-tight">{t.title}</h3>
        <p className="mt-1 text-sm">
          {t.placeCount} {t.placeCount === 1 ? "place" : "places"}
          <span className="text-navy/60"> · closest: </span>
          {t.closest.name}, {formatDistance(t.closest.distanceKm)}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={watched}
        aria-label={`${watched ? "Watched" : "Mark as watched"}: ${t.title}`}
        className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${
          watched ? "bg-gold text-navy" : "border border-navy/30 text-navy"
        }`}
      >
        {watched ? "✓ Watched" : "Watched it"}
      </button>
    </article>
  );
}
