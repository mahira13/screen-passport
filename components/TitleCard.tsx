"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistance } from "@/lib/distance";
import type { NearbyPlace, NearbyTitle } from "@/lib/nearby";
import { LocationCard } from "./LocationCard";

type Props = {
  title: NearbyTitle;
  places: NearbyPlace[];
  colour: string;
  watched: boolean;
  selected: boolean;
  tripFrom: string; // city id or "lat,lng" for /trip/new
  onToggle: () => void;
  onSelect: () => void;
};

export function TitleCard({ title: t, places, colour, watched, selected, tripFrom, onToggle, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const listId = `places-${t.workId}`;
  return (
    <article
      className={`group relative overflow-hidden rounded-md bg-surface transition-colors hover:bg-[#262626] ${
        selected ? "ring-2 ring-ink" : watched ? "ring-2 ring-accent" : ""
      }`}
    >
      {/* Colour strip: the title's colour on the map. */}
      <span aria-hidden className="block h-1 w-full" style={{ background: colour }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Tapping the title shows only this title on the map (tap again for all). */}
          <button type="button" onClick={onSelect} aria-pressed={selected}
            aria-label={`${selected ? "Showing" : "Show"} ${t.title} on the map`}
            className="min-w-0 flex-1 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/50">
              {t.type === "series" ? "Series" : "Film"}
              {selected && <span className="text-accent"> · on the map</span>}
            </p>
            <h3 className="mt-0.5 text-xl font-bold leading-tight">{t.title}</h3>
            <p className="mt-1 text-sm text-ink/70">
              <span className="font-semibold text-ink">{t.placeCount} {t.placeCount === 1 ? "place" : "places"}</span>
              {" · closest "}
              {t.closest.name}, {formatDistance(t.closest.distanceKm)}
            </p>
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={watched}
            aria-label={`${watched ? "Watched" : "Mark as watched"}: ${t.title}`}
            className={`shrink-0 rounded px-3 py-2 text-sm font-semibold transition-colors ${
              watched ? "bg-accent text-white" : "bg-ink/10 text-ink hover:bg-ink/20"
            }`}
          >
            {watched ? "✓ Watched" : "+ Watched it"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={listId}
            className="text-sm font-medium text-ink/70 hover:text-ink"
          >
            {open ? "Hide places ▴" : `${places.length === 1 ? "See the place" : `See all ${places.length} places`} ▾`}
          </button>
          <Link href={`/trip/new?works=${encodeURIComponent(t.workId)}&from=${encodeURIComponent(tripFrom)}`}
            className="shrink-0 rounded bg-ink px-3 py-1.5 text-sm font-bold text-paper hover:bg-ink/85">
            Create a trip
          </Link>
        </div>
        {open && (
          <ul id={listId} className="mt-3 space-y-2">
            {places.map((p) => (
              <li key={p.id}>
                <LocationCard place={p} titlePlaces={places} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
