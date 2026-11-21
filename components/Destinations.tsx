"use client";

import type { Destination } from "@/lib/destinations";

type Props = { items: Destination[]; current: string; onPick: (cityId: string) => void };

/** Cities with the most sourced filming places. Start cities can be picked as the map's start. */
export function Destinations({ items, current, onPick }: Props) {
  if (items.length === 0) return null;
  return (
    <ol className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((d, i) => {
        const body = (
          <>
            <span className="font-condensed text-lg text-smoke tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className={`min-w-0 flex-1 truncate font-serif text-3xl leading-tight sm:text-4xl ${d.cityId === current ? "italic text-accent" : ""}`}>
              {d.city}
            </span>
            <span className="label shrink-0 text-right text-smoke">
              {d.places} {d.places === 1 ? "place" : "places"}<br />{d.titles} {d.titles === 1 ? "title" : "titles"}
            </span>
          </>
        );
        return (
          <li key={d.city}>
            {d.cityId ? (
              <button type="button" onClick={() => onPick(d.cityId!)} aria-label={`Start from ${d.city}`}
                className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:text-accent">
                {body}
                <span aria-hidden className="text-accent opacity-0 transition-opacity group-hover:opacity-100">→</span>
              </button>
            ) : (
              <div className="flex items-center gap-4 py-3 pr-6">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
