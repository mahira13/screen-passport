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
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="city">Start from</label>
      <select
        id="city"
        value={value}
        onChange={(e) => onCity(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-navy/20 bg-white px-3 py-2.5 text-base"
      >
        {value === "me" && <option value="me">My location</option>}
        {CITIES.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onMyLocation}
        disabled={locating}
        className="shrink-0 rounded-lg bg-navy px-3 py-2.5 text-sm font-medium text-cream disabled:opacity-60"
      >
        {locating ? "Locating…" : "Use my location"}
      </button>
    </div>
  );
}
