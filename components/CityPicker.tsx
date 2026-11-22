"use client";

import { CITIES } from "@/lib/cities";

type Props = {
  value: string; // a city id, or "me"
  locating: boolean;
  onCity: (id: string) => void;
  onMyLocation: () => void;
};

export function CityPicker({ value, locating, onCity, onMyLocation }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label className="label text-ink/60" htmlFor="city">Start from</label>
        <select
          id="city"
          value={value}
          onChange={(e) => onCity(e.target.value)}
          className="mt-1 block w-full cursor-pointer appearance-none border-b-2 border-ink/40 bg-transparent py-2 pr-8 font-serif text-3xl text-ink focus:border-accent focus:outline-none"
          style={{ backgroundImage: "linear-gradient(45deg, transparent 50%, #e3b04b 50%), linear-gradient(135deg, #e3b04b 50%, transparent 50%)", backgroundPosition: "calc(100% - 14px) 55%, calc(100% - 8px) 55%", backgroundSize: "6px 6px", backgroundRepeat: "no-repeat" }}
        >
          {value === "me" && <option value="me">My location</option>}
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onMyLocation}
        disabled={locating}
        className="label inline-flex shrink-0 items-center justify-center gap-2 border border-accent px-4 py-3 text-accent transition-colors hover:bg-accent hover:text-paper disabled:opacity-60"
      >
        <span aria-hidden>◎</span>
        {locating ? "Locating…" : "Use my location"}
      </button>
    </div>
  );
}
