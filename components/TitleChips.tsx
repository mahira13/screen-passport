"use client";

import type { NearbyTitle } from "@/lib/nearby";

type Props = {
  titles: NearbyTitle[];
  colours: Map<string, string>;
  selected: string | null;
  onSelect: (workId: string | null) => void;
};

const chip = "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors";

/** Filter row above the map. Also the map's legend: each chip shows its colour and names the title. */
export function TitleChips({ titles, colours, selected, onSelect }: Props) {
  if (titles.length === 0) return null;
  return (
    <div role="group" aria-label="Show on the map" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}
        className={`${chip} ${selected === null ? "bg-ink text-paper ring-ink" : "bg-surface text-ink ring-ink/15 hover:bg-[#2a2a2a]"}`}>
        All titles
      </button>
      {titles.map((t) => {
        const on = selected === t.workId;
        return (
          <button key={t.workId} type="button" aria-pressed={on} onClick={() => onSelect(on ? null : t.workId)}
            className={`${chip} ${on ? "bg-ink text-paper ring-ink" : "bg-surface text-ink ring-ink/15 hover:bg-[#2a2a2a]"}`}>
            <span aria-hidden className="h-3 w-3 rounded-full ring-2 ring-ink" style={{ background: colours.get(t.workId) }} />
            {t.title}
          </button>
        );
      })}
    </div>
  );
}
