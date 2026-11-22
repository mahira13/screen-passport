"use client";

import type { NearbyTitle } from "@/lib/nearby";

type Props = {
  titles: NearbyTitle[];
  colours: Map<string, string>;
  selected: string | null;
  onSelect: (workId: string | null) => void;
};

const chip = "flex shrink-0 items-center gap-2 border px-3.5 py-2 text-sm font-medium transition-colors";
const on = "border-accent bg-accent text-paper";
const off = "border-ink/15 bg-transparent text-ink/85 hover:border-ink/50";

/** Filter row above the map. Also the map's legend: each chip shows its colour and names the title. */
export function TitleChips({ titles, colours, selected, onSelect }: Props) {
  if (titles.length === 0) return null;
  return (
    <div role="group" aria-label="Show on the map" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}
        className={`${chip} label ${selected === null ? on : off}`}>
        All titles
      </button>
      {titles.map((t) => {
        const active = selected === t.workId;
        return (
          <button key={t.workId} type="button" aria-pressed={active} onClick={() => onSelect(active ? null : t.workId)}
            className={`${chip} ${active ? on : off}`}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-paper" style={{ background: colours.get(t.workId) }} />
            {t.title}
          </button>
        );
      })}
    </div>
  );
}
