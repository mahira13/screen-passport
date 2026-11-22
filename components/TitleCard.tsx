"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistance } from "@/lib/distance";
import { typeYear } from "@/lib/covers";
import type { NearbyPlace, NearbyTitle, Photo } from "@/lib/nearby";
import { Cover } from "./Cover";
import { LocationCard } from "./LocationCard";

type Props = {
  title: NearbyTitle;
  places: NearbyPlace[];
  colour: string;
  watched: boolean;
  selected: boolean;
  tripFrom: string; // city id or "lat,lng" for /trip/new
  index: number; // position in the index, from 0
  featured?: boolean;
  photo?: Photo | null; // chosen by the list so no two cards share a Commons file
  onToggle: () => void;
  onSelect: () => void;
};

const quiet = "label inline-flex min-h-11 items-center px-1 text-ink/60 transition-colors hover:text-accent";

export function TitleCard({ title: t, places, colour, watched, selected, tripFrom, featured = false, photo: chosen, onToggle, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const listId = `places-${t.workId}`;
  const photo = chosen !== undefined ? chosen : t.closest.photo ?? places.find((p) => p.photo)?.photo ?? null;

  return (
    <article className={`relative h-full overflow-hidden rounded-sm bg-surface ring-2 transition-shadow ${selected ? "ring-accent" : "ring-transparent"}`}>
      {/* Tapping the photo or title shows only this title on the map (tap again for all). */}
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`${selected ? "Showing" : "Show"} ${t.title} on the map`}
        className="group block w-full text-left">
        <div className="relative">
          <Cover photo={photo} label={t.title} className={featured ? "aspect-[16/9]" : "aspect-[4/3]"} />
          <span className="label absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-sm bg-paper/80 px-2 py-1 text-[10px] text-ink backdrop-blur-sm">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colour }} />
            {formatDistance(t.closest.distanceKm)}{selected && " · on the map"}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-7 pt-20">
            <h3 className={`font-display leading-[1.02] tracking-tight text-ink drop-shadow ${featured ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>
              {t.title}
            </h3>
          </div>
          {watched && (
            <span aria-hidden className="absolute right-3 top-3 z-10 rotate-[8deg] border-2 border-double border-accent bg-paper/70 px-2 py-0.5 font-display text-sm tracking-[0.18em] text-accent backdrop-blur-sm">
              Stamped
            </span>
          )}
        </div>
        <p className="px-4 pt-3 text-sm text-ink/65">{typeYear(t.type, t.year)}</p>
      </button>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-4 pt-3">
        <button type="button" onClick={onToggle} aria-pressed={watched} aria-label={`${watched ? "Watched" : "Mark as watched"}: ${t.title}`}
          className={`label rounded-sm px-4 transition-colors ${watched ? "bg-accent text-paper" : "bg-accent/15 text-accent hover:bg-accent hover:text-paper"}`}>
          {watched ? "✓ Watched" : "+ Watched it"}
        </button>
        <Link href={`/trip/new?works=${encodeURIComponent(t.workId)}&from=${encodeURIComponent(tripFrom)}`} className={quiet}>Trip</Link>
        <Link href={`/title/${encodeURIComponent(t.workId)}`} className={quiet}>Details</Link>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={listId} className={`${quiet} ml-auto`}>
          {open ? "Hide ▴" : `${places.length === 1 ? "Place" : `${places.length} places`} ▾`}
        </button>
      </div>
      {open && (
        <ul id={listId} className="space-y-3 px-4 pb-4">
          {places.map((p) => (
            <li key={p.id}>
              <LocationCard place={p} titlePlaces={places} showPhoto={!photo || p.photo?.url !== photo.url} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
