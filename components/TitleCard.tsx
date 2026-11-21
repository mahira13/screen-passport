"use client";

import { useState } from "react";
import { formatDistance } from "@/lib/distance";
import type { NearbyPlace, NearbyTitle } from "@/lib/nearby";
import { LocationCard } from "./LocationCard";

type Props = { title: NearbyTitle; places: NearbyPlace[]; watched: boolean; onToggle: () => void };

export function TitleCard({ title: t, places, watched, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const listId = `places-${t.workId}`;
  return (
    <article className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${watched ? "ring-2 ring-gold" : "ring-navy/10"}`}>
      <div className="flex items-start gap-3">
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
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="mt-2 text-sm font-medium text-navy underline underline-offset-2"
      >
        {open ? "Hide places" : `Show ${places.length === 1 ? "the place" : `all ${places.length} places`}`}
      </button>
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
