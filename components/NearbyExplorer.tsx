"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { DEFAULT_CITY, findCity } from "@/lib/cities";
import { titlesByBand, type NearbyResult } from "@/lib/nearby";
import { passportSummary } from "@/lib/passport";
import { toggleWatched } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";
import type { LatLng } from "@/lib/types";
import { CityPicker } from "./CityPicker";
import { PassportBar } from "./PassportBar";
import { TitleCard } from "./TitleCard";

const NearbyMap = dynamic(() => import("./NearbyMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-navy/10" />,
});

type Origin = LatLng & { id: string; label: string }; // id: a city id or "me"

const LOAD_ERROR = "Couldn't load places. Check your connection and try again.";

async function fetchNearby(query: string): Promise<NearbyResult> {
  const res = await fetch(`/api/nearby?${query}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const cityOrigin = (id: string): Origin => {
  const c = findCity(id) ?? DEFAULT_CITY;
  return { id: c.id, label: c.name, lat: c.lat, lng: c.lng };
};

export function NearbyExplorer({ initial }: { initial: NearbyResult | null }) {
  const [origin, setOrigin] = useState<Origin>(() => cityOrigin(DEFAULT_CITY.id));
  const [data, setData] = useState<NearbyResult | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useRef(0);
  const mapTracked = useRef(false);
  const passport = usePassport();

  const load = useCallback((next: Origin, query: string) => {
    const id = ++requestId.current; // ignore answers to older requests
    setLoading(true);
    setMessage(null);
    fetchNearby(query)
      .then((json) => {
        if (id !== requestId.current) return;
        setOrigin(next);
        setData(json);
      })
      .catch(() => id === requestId.current && setMessage(LOAD_ERROR))
      .finally(() => id === requestId.current && setLoading(false));
  }, []);

  // The server could not prepare the first list: fetch it here instead.
  useEffect(() => {
    if (initial !== null) return;
    const id = requestId.current;
    fetchNearby(`city=${DEFAULT_CITY.id}`)
      .then((json) => id === requestId.current && setData(json))
      .catch(() => id === requestId.current && setMessage(LOAD_ERROR))
      .finally(() => id === requestId.current && setLoading(false));
  }, [initial]);

  const pickCity = (id: string) => load(cityOrigin(id), `city=${encodeURIComponent(id)}`);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Your browser can't share a location. Pick a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // About 100 m precision is plenty for "about X km" and keeps the exact spot on the phone.
        const lat = pos.coords.latitude.toFixed(3);
        const lng = pos.coords.longitude.toFixed(3);
        load({ id: "me", label: "your location", lat: Number(lat), lng: Number(lng) }, `lat=${lat}&lng=${lng}`);
      },
      () => {
        setLocating(false);
        setMessage("Couldn't get your location. Pick a city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const onMapReady = () => {
    if (mapTracked.current) return;
    mapTracked.current = true;
    track("map_viewed", { origin: origin.id === "me" ? "my_location" : origin.id, places: data?.places.length ?? 0 });
  };

  const groups = data ? titlesByBand(data.titles) : [];
  const watched = new Set(passport.watched);
  const startCity = origin.id === "me" ? null : origin.id;

  return (
    <>
      <CityPicker value={origin.id} locating={locating} onCity={pickCity} onMyLocation={useMyLocation} />
      {message && <p role="alert" className="mt-2 text-sm text-red-800">{message}</p>}

      <div className="relative mt-3 h-[42vh] max-h-[420px] min-h-[240px] overflow-hidden rounded-xl ring-1 ring-navy/10">
        <NearbyMap origin={origin} places={data?.places ?? []} onReady={onMapReady} />
      </div>

      <section aria-live="polite" aria-busy={loading} className={`mt-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {data && groups.length === 0 && !loading && (
          <p className="rounded-xl bg-white p-4 text-sm ring-1 ring-navy/10">
            No filming places to show yet. We&apos;re checking our sources and adding them now.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mb-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">
              {g.label} <span className="font-normal">from {origin.label}</span>
            </h2>
            <ul className="mt-2 space-y-3">
              {g.titles.map((t) => (
                <li key={t.workId}>
                  <TitleCard title={t} watched={watched.has(t.workId)} onToggle={() => toggleWatched(t.workId, startCity)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <PassportBar summary={passportSummary(passport.watched, data)} passportId={passport.id} sync={passport.sync} />
    </>
  );
}
