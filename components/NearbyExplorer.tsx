"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { DEFAULT_CITY, findCity } from "@/lib/cities";
import { colourMap, OTHER_COLOUR } from "@/lib/colours";
import { focusPlaces, titlesByBand, visiblePlaces, type NearbyResult } from "@/lib/nearby";
import { passportSummary } from "@/lib/passport";
import { toggleWatched } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";
import type { LatLng } from "@/lib/types";
import type { Destination } from "@/lib/destinations";
import { CityPicker } from "./CityPicker";
import { Destinations } from "./Destinations";
import { HomeHero } from "./HomeHero";
import { PassportBar } from "./PassportBar";
import { TitleSearch } from "./TitleSearch";
import { TitleChips } from "./TitleChips";
import { TitleCard } from "./TitleCard";

const NearbyMap = dynamic(() => import("./NearbyMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

type Origin = LatLng & { id: string; label: string }; // id: a city id or "me"

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";

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

type Props = { initial: NearbyResult | null; destinations: Destination[] };

export function NearbyExplorer({ initial, destinations }: Props) {
  const [origin, setOrigin] = useState<Origin>(() => cityOrigin(DEFAULT_CITY.id));
  const [data, setData] = useState<NearbyResult | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useRef(0);
  const mapTracked = useRef(false);
  const passport = usePassport();
  const [selectedRaw, setSelected] = useState<string | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  // Memoised so watching a title doesn't re-zoom the map.
  const places = useMemo(() => data?.places ?? [], [data]);
  const titles = useMemo(() => data?.titles ?? [], [data]);
  const colours = useMemo(() => colourMap(titles.map((t) => t.workId)), [titles]);
  const selected = selectedRaw && titles.some((t) => t.workId === selectedRaw) ? selectedRaw : null;
  const mapPlaces = useMemo(() => visiblePlaces(places, selected), [places, selected]);
  const mapFocus = useMemo(() => focusPlaces(places, selected), [places, selected]);

  const selectFromCard = (workId: string) => {
    setSelected(selected === workId ? null : workId);
    const box = mapBox.current?.getBoundingClientRect();
    if (box && box.bottom < 80) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // From the hero plates and the search: always show that title and bring the map into view.
  const showOnMap = (workId: string) => {
    setSelected(workId);
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
  const tripFrom = origin.id === "me" ? `${origin.lat},${origin.lng}` : origin.id;

  const ticker = ["Discover your cinema", "Explore the world", "Collect your stories"];
  // Running number across all bands in the index ("01", "02", …).
  const offsets = groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.titles.length, 0));

  return (
    <>
      <HomeHero cityLabel={origin.id === "me" ? "Near you" : origin.label} titles={titles} placeCount={places.length}
        onPick={showOnMap} search={<TitleSearch titles={titles} onPick={showOnMap} />} />

      {/* Pillars ticker, like the credits line of a film studio site. */}
      <div aria-hidden className="overflow-hidden bg-accent py-3 text-paper">
        <div className="ticker flex w-max gap-10 whitespace-nowrap font-condensed text-2xl tracking-[0.08em] sm:text-3xl">
          {[0, 1, 2, 3].flatMap((k) => ticker.map((t) => (
            <span key={`${k}-${t}`} className="flex items-center gap-10">{t}<span className="font-serif italic">—</span></span>
          )))}
        </div>
      </div>

      <section id="discover" className="scroll-mt-16 pt-14 sm:pt-20">
        <div className={WRAP}>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <p className="label text-accent">01 — Discover</p>
              <h2 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
                Filmed near <span className="italic">{origin.id === "me" ? "you" : origin.label}.</span>
              </h2>
              <p className="mt-4 max-w-lg text-ink/70">
                Every pin is a real filming place with a source. Pick where you start, then tap a title to see only its places.
              </p>
            </div>
            <CityPicker value={origin.id} locating={locating} onCity={pickCity} onMyLocation={useMyLocation} />
          </div>
          {message && <p role="alert" className="mt-3 text-sm text-red-400">{message}</p>}
          <TitleChips titles={titles} colours={colours} selected={selected} onSelect={setSelected} />
        </div>

        <div className={`${WRAP} mt-6 grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-20`}>
          <div ref={mapBox} className="relative h-[56vh] max-h-[640px] min-h-[300px] scroll-mt-20 overflow-hidden -mx-4 sm:mx-0">
            <NearbyMap origin={origin} places={mapPlaces} focus={mapFocus} colours={colours} onReady={onMapReady} />
            <span aria-hidden className="pointer-events-none absolute left-3 top-3 z-[500] h-6 w-6 border-l-2 border-t-2 border-accent" />
            <span aria-hidden className="pointer-events-none absolute bottom-6 right-3 z-[500] h-6 w-6 border-b-2 border-r-2 border-accent" />
          </div>
          {destinations.length > 0 && (
            <aside>
              <p className="label text-ink/60">Cinematic destinations</p>
              <p className="mt-1 font-serif text-2xl italic text-ink/80">Where the most places are</p>
              <div className="mt-4">
                <Destinations items={destinations} current={origin.id} onPick={(id) => {
                  pickCity(id);
                  mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }} />
              </div>
            </aside>
          )}
        </div>
      </section>

      <section id="index" aria-live="polite" aria-busy={loading}
        className={`scroll-mt-16 border-t border-ink/10 pb-20 pt-14 transition-opacity sm:pt-20 ${loading ? "opacity-60" : ""}`}>
        <div className={WRAP}>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/20 pb-5">
            <div>
              <p className="label text-accent">02 — Explore</p>
              <h2 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
                The index<span className="italic text-accent">.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm text-ink/70">
              Films and series shot around {origin.label}, closest first. Mark what you&apos;ve watched to fill your passport.
            </p>
          </div>

          {data && groups.length === 0 && !loading && (
            <p className="mt-8 bg-surface p-5 text-sm">
              No filming places to show yet. We&apos;re checking our sources and adding them now.
            </p>
          )}
          {groups.map((g, gi) => (
            <div key={g.key} className="mt-12">
              <h3 className="flex items-baseline gap-3">
                <span className="font-condensed text-3xl tracking-wide sm:text-4xl">{g.label}</span>
                <span className="font-serif text-xl italic text-ink/60">from {origin.label}</span>
                <span className="label ml-auto text-ink/60">{g.titles.length} {g.titles.length === 1 ? "title" : "titles"}</span>
              </h3>
              <ul className="mt-6 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.titles.map((t, ti) => {
                  const featured = gi === 0 && ti === 0;
                  const index = offsets[gi] + ti;
                  return (
                    <li key={t.workId} className={featured ? "sm:col-span-2 lg:col-span-3" : ""}>
                      <TitleCard
                        title={t}
                        places={places.filter((p) => p.workId === t.workId)}
                        colour={colours.get(t.workId) ?? OTHER_COLOUR}
                        watched={watched.has(t.workId)}
                        selected={selected === t.workId}
                        tripFrom={tripFrom}
                        index={index}
                        featured={featured}
                        onToggle={() => toggleWatched(t.workId, startCity)}
                        onSelect={() => selectFromCard(t.workId)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <PassportBar summary={passportSummary(passport.watched, data)} passportId={passport.id} sync={passport.sync} />
    </>
  );
}
