"use client";

import { RADII, radiusLabel, type Radius } from "@/lib/discover";

type Props = { value: Radius; auto?: boolean; onPick: (r: Radius) => void };

/** 5 · 10 · 25 · 50 km · Anywhere (straight-line distance from the start). auto: picked for the user's location. */
export function RadiusChips({ value, auto = false, onPick }: Props) {
  return (
    <div className="mt-6">
      <div role="radiogroup" aria-label="Distance" className="flex flex-wrap gap-2">
        {RADII.map((r) => {
          const on = r === value;
          return (
            <button key={String(r)} type="button" role="radio" aria-checked={on} onClick={() => !on && onPick(r)}
              className={`label inline-flex min-h-11 items-center border px-4 transition-colors ${
                on ? "border-accent bg-accent text-paper" : "border-ink/25 text-ink/80 hover:border-accent hover:text-accent"}`}>
              {radiusLabel(r)}
              {on && auto && <span className="ml-1.5 font-sans text-[10px] normal-case tracking-normal opacity-80">· auto</span>}
            </button>
          );
        })}
      </div>
      {auto && (
        <p className="mt-2 text-xs text-ink/65">
          {value === null
            ? "Picked for you: fewer than 3 places within 50 km, so showing everything, closest first."
            : "Picked for you: the smallest distance with at least 3 places."}
        </p>
      )}
    </div>
  );
}
