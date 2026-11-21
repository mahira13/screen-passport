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
      className={`rounded-xl bg-white p-4 shadow-sm ${
        selected ? "ring-2 ring-navy" : watched ? "ring-2 ring-gold" : "ring-1 ring-navy/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Tapping the title shows only this title on the map (tap again for all). */}
        <button type="button" onClick={onSelect} aria-pressed={selected}
          aria-label={`${selected ? "Showing" : "Show"} ${t.title} on the map`}
          className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-navy/60">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-2 ring-navy" style={{ background: colour }} />
            {t.type === "series" ? "Series" : "Film"}
            {selected && <span className="normal-case tracking-normal text-navy"> · on the map</span>}
          </p>
          <h3 className="font-display text-lg font-semibold leading-tight">{t.title}</h3>
          <p className="mt-1 text-sm">
            {t.placeCount} {t.placeCount === 1 ? "place" : "places"}
            <span className="text-navy/60"> · closest: </span>
            {t.closest.name}, {formatDistance(t.closest.distanceKm)}
          </p>
        </button>
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
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="text-sm font-medium text-navy underline underline-offset-2"
        >
          {open ? "Hide places" : `Show ${places.length === 1 ? "the place" : `all ${places.length} places`}`}
        </button>
        <Link href={`/trip/new?works=${encodeURIComponent(t.workId)}&from=${encodeURIComponent(tripFrom)}`}
          className="shrink-0 rounded-full border border-navy/30 px-3 py-1.5 text-sm font-medium">
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
    </article>
  );
}
