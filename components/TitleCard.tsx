"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistance } from "@/lib/distance";
import type { NearbyPlace, NearbyTitle } from "@/lib/nearby";
import { LocationCard } from "./LocationCard";
import { ScenePlate } from "./ScenePlate";

type Props = {
  title: NearbyTitle;
  places: NearbyPlace[];
  colour: string;
  watched: boolean;
  selected: boolean;
  tripFrom: string; // city id or "lat,lng" for /trip/new
  index: number; // position in the index, from 0
  featured?: boolean;
  onToggle: () => void;
  onSelect: () => void;
};

// Sits on the cream "Index" section, so colours are set explicitly (night on cream).
export function TitleCard({ title: t, places, colour, watched, selected, tripFrom, index, featured = false, onToggle, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const listId = `places-${t.workId}`;
  const number = String(index + 1).padStart(2, "0");

  const head = (
    <>
      <div className="flex items-center gap-3">
        <span className="font-condensed text-2xl leading-none text-night/35 tabular-nums">{number}</span>
        <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-night/40" style={{ background: colour }} />
        <span className="label text-night/55">
          {t.type === "series" ? "Series" : "Film"}
          {selected && <span className="text-burgundy"> · on the map</span>}
        </span>
      </div>
      {/* Tapping the title shows only this title on the map (tap again for all). */}
      <button type="button" onClick={onSelect} aria-pressed={selected}
        aria-label={`${selected ? "Showing" : "Show"} ${t.title} on the map`}
        className="mt-3 block text-left">
        <h3 className={`font-serif leading-[0.95] tracking-tight text-night decoration-burgundy decoration-2 underline-offset-4 hover:underline ${
          featured ? "text-5xl sm:text-6xl" : "text-[2.1rem]"}`}>
          {t.title}
        </h3>
      </button>
      <p className="mt-3 text-sm text-night/70">
        <span className="font-semibold text-night">{t.placeCount} {t.placeCount === 1 ? "place" : "places"}</span>
        {" · closest "}
        {t.closest.name}, {formatDistance(t.closest.distanceKm)}
      </p>
    </>
  );

  return (
    <article className={`relative border-t-2 pt-4 transition-colors ${selected ? "border-burgundy" : "border-night/15"}`}>
      {watched && (
        <span aria-hidden className="pointer-events-none absolute right-0 top-3 z-10 rotate-[8deg] border-2 border-double border-burgundy px-2 py-0.5 font-condensed text-sm tracking-[0.18em] text-burgundy">
          Stamped
        </span>
      )}

      {featured ? (
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <button type="button" onClick={onSelect} tabIndex={-1} aria-hidden className="block text-left">
            <ScenePlate index={index} className="aspect-[2.39/1] w-full">
              <p className="label text-ink/70">Closest scene · {formatDistance(t.closest.distanceKm)}</p>
              <p className="font-condensed text-3xl leading-none tracking-wide text-ink sm:text-4xl">{t.closest.name}</p>
              {t.closest.sceneNote && <p className="mt-1 line-clamp-1 font-serif italic text-accent">{t.closest.sceneNote}</p>}
            </ScenePlate>
          </button>
          <div>{head}</div>
        </div>
      ) : (
        head
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={watched}
          aria-label={`${watched ? "Watched" : "Mark as watched"}: ${t.title}`}
          className={`label px-4 py-2.5 transition-colors ${
            watched ? "bg-night text-mustard" : "border border-night text-night hover:bg-night hover:text-cream"
          }`}
        >
          {watched ? "✓ Watched" : "+ Watched it"}
        </button>
        <Link href={`/trip/new?works=${encodeURIComponent(t.workId)}&from=${encodeURIComponent(tripFrom)}`}
          className="label bg-burgundy px-4 py-2.5 text-cream transition-colors hover:bg-night">
          Create a trip
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="label ml-auto py-2.5 text-night/65 underline-offset-4 hover:text-night hover:underline"
        >
          {open ? "Hide places ▴" : `${places.length === 1 ? "See the place" : `All ${places.length} places`} ▾`}
        </button>
      </div>
      {open && (
        <ul id={listId} className="mt-4 space-y-3">
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
