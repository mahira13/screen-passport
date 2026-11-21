"use client";

import type { NearbyTitle } from "@/lib/nearby";

type Props = {
  titles: NearbyTitle[];
  colours: Map<string, string>;
  selected: string | null;
  onSelect: (workId: string | null) => void;
};

const chip = "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1";

/** Filter row above the map. Also the map's legend: each chip shows its colour and names the title. */
export function TitleChips({ titles, colours, selected, onSelect }: Props) {
  if (titles.length === 0) return null;
  return (
    <div role="group" aria-label="Show on the map" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}
        className={`${chip} ${selected === null ? "bg-navy text-cream ring-navy" : "bg-white text-navy ring-navy/20"}`}>
        All titles
      </button>
      {titles.map((t) => {
        const on = selected === t.workId;
        return (
          <button key={t.workId} type="button" aria-pressed={on} onClick={() => onSelect(on ? null : t.workId)}
            className={`${chip} ${on ? "bg-navy text-cream ring-navy" : "bg-white text-navy ring-navy/20"}`}>
            <span aria-hidden className="h-3 w-3 rounded-full ring-2 ring-navy" style={{ background: colours.get(t.workId) }} />
            {t.title}
          </button>
        );
      })}
    </div>
  );
}
