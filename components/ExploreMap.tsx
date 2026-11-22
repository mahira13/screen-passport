"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import type { City } from "@/lib/cities";
import type { Radius } from "@/lib/discover";
import { applyFilters, type MapPlace } from "@/lib/explore-map";
import type { LatLng } from "@/lib/types";
import { RadiusChips } from "./RadiusChips";

const Canvas = dynamic(() => import("./ExploreMapCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-surface"><span className="label animate-pulse text-ink/60">Loading the map…</span></div>,
});

export type MapCollection = { key: string; name: string; placeIds: number[] };

type Props = { places: MapPlace[]; collections: MapCollection[]; cities: City[]; start: City };

const select = "min-h-11 w-full border-b-2 border-ink/30 bg-transparent py-1 text-ink focus:border-accent focus:outline-none";

/** Full-screen map of every published place, with title, collection, city and radius filters. */
export function ExploreMap({ places, collections, cities, start }: Props) {
  const [title, setTitle] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [radius, setRadius] = useState<Radius>(null);
  const [origin, setOrigin] = useState<LatLng & { label: string }>({ lat: start.lat, lng: start.lng, label: start.name });
  const [mine, setMine] = useState<LatLng | null>(null); // the visitor's own position: distances in popups
  const [note, setNote] = useState<string | null>(null);

  // Start near the visitor: the IP hint picks the nearest city with places (never stored).
  useEffect(() => {
    fetch("/api/start").then((r) => (r.ok ? r.json() : null)).then((j: { city: string | null } | null) => {
      const c = cities.find((x) => x.id === j?.city);
      if (c) setOrigin((o) => (o.label === start.name ? { lat: c.lat, lng: c.lng, label: c.name } : o));
    }).catch(() => {});
    track("map_viewed", { origin: "explore", places: places.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival

  const titles = useMemo(() => [...new Map(places.flatMap((p) => p.titles).map((t) => [t.id, t])).values()].sort((a, b) => a.title.localeCompare(b.title)), [places]);
  const cityNames = useMemo(() => [...new Set(places.map((p) => p.city).filter((c): c is string => !!c))].sort(), [places]);
  const chosen = collections.find((c) => c.key === collection) ?? null;
  const markers = useMemo(() => applyFilters(places, { title, collection: chosen, city, radiusKm: radius }, origin), [places, title, chosen, city, radius, origin]);
  const shown = markers.filter((m) => !m.faded).length;
  const filtered = !!(title || collection || city || radius !== null);
  const clear = () => { setTitle(null); setCollection(null); setCity(null); setRadius(null); };

  const locate = () => {
    if (!navigator.geolocation) return setNote("Your browser can't share a location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: Number(pos.coords.latitude.toFixed(3)), lng: Number(pos.coords.longitude.toFixed(3)) }; // ~100 m, stays on the phone
        setMine(p);
        setOrigin({ ...p, label: "your location" });
        setNote(null);
      },
      () => setNote("Couldn't get your location. Pick a city or a radius instead."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  if (places.length === 0) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink/70">No verified places on the map yet. We&apos;re checking the sources first.</p>
        <a href="/collections" className="label mt-6 inline-flex min-h-11 items-center bg-accent px-5 text-paper">Browse collections</a>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-8.5rem)] min-h-[420px] w-full sm:h-[calc(100dvh-4.5rem)]">
      <Canvas markers={markers} origin={origin} from={mine} fitKey={`${title}|${collection}|${city}|${radius}|${origin.lat},${origin.lng}`} />

      <details className="absolute left-3 right-3 top-3 z-[1000] max-w-md border border-ink/15 bg-paper/95 p-3 shadow-2xl backdrop-blur sm:left-4 sm:right-auto sm:w-96" open>
        <summary className="label flex min-h-11 cursor-pointer items-center justify-between text-ink/80">
          <span>{shown} {shown === 1 ? "place" : "places"}{filtered ? " match" : ""} · near {origin.label}</span>
          <span className="text-accent">Filters</span>
        </summary>
        <div className="mt-2 grid gap-3">
          <label className="label text-ink/60">Title
            <select className={select} value={title ?? ""} onChange={(e) => setTitle(e.target.value || null)}>
              <option value="">All titles</option>
              {titles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          {collections.length > 0 && (
            <label className="label text-ink/60">Collection
              <select className={select} value={collection ?? ""} onChange={(e) => setCollection(e.target.value || null)}>
                <option value="">All collections</option>
                {collections.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label className="label text-ink/60">City
            <select className={select} value={city ?? ""} onChange={(e) => setCity(e.target.value || null)}>
              <option value="">All cities</option>
              {cityNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="-mt-4"><RadiusChips value={radius} onPick={setRadius} /></div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={locate} className="label inline-flex min-h-11 items-center border border-accent px-4 text-accent">◎ Use my location</button>
            {filtered && <button type="button" onClick={clear} className="label inline-flex min-h-11 items-center text-ink/70 underline-offset-4 hover:underline">Clear filters</button>}
          </div>
          {note && <p role="alert" className="text-sm text-red-400">{note}</p>}
          {shown === 0 && (
            <p role="status" className="text-sm text-ink/80">
              No places match these filters.{" "}
              <button type="button" onClick={clear} className="label text-accent underline-offset-4 hover:underline">Clear filters</button>
            </p>
          )}
          <p className="text-xs text-ink/60">Photo markers use the place&apos;s own Commons photo. A dashed ring means an approximate location: no check-in there.</p>
        </div>
      </details>
    </div>
  );
}
