"use client";

import { REGION } from "@/lib/region";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { findCity, type City } from "@/lib/cities";
import { colourMap, OTHER_COLOUR } from "@/lib/colours";
import { focusPlaces, titlesByBand, visiblePlaces, type NearbyResult } from "@/lib/nearby";
import { passportSummary } from "@/lib/passport";
import { toggleWatched } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";
import type { LatLng } from "@/lib/types";
import type { CollectionModel } from "@/lib/collections-model";
import type { Destination } from "@/lib/destinations";
import { emptyMessage, radiusLabel, widerRadius, type PopularTitle, type Radius, type SearchHit } from "@/lib/discover";
import { distinctCovers } from "@/lib/covers";
import { CityPicker } from "./CityPicker";
import { Destinations } from "./Destinations";
import { InfoTip } from "./InfoTip";
import { PassportBar } from "./PassportBar";
import { CatalogueSearch } from "./CatalogueSearch";
import { FeaturedCollections } from "./FeaturedCollections";
import { PopularTitles } from "./PopularTitles";
import { RadiusChips } from "./RadiusChips";
import { TitleChips } from "./TitleChips";
import { TitleCard } from "./TitleCard";

const NearbyMap = dynamic(() => import("./NearbyMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

type Origin = LatLng & { id: string; label: string }; // id: a city id, "me", or "at:<place>" from search

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";

const LOAD_ERROR = "Couldn't load places. Check your connection and try again.";

async function fetchNearby(query: string): Promise<NearbyResult> {
  const res = await fetch(`/api/nearby?${query}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const originOf = (c: City): Origin => ({ id: c.id, label: c.name, lat: c.lat, lng: c.lng });

const queryFor = (cities: City[], o: Origin, r: Radius | "auto") =>
  (findCity(cities, o.id) ? `city=${encodeURIComponent(o.id)}` : `lat=${o.lat}&lng=${o.lng}`) + (r === null ? "" : `&radius=${r}`);

// "discover": hero, map, the title index, featured collections and popular titles. "map": the map on its own, taller.
type Props = {
  initial: NearbyResult | null; // places around start, rendered on the server
  cities: City[]; // start cities, built from published places
  start: City; // the default start: the city with the most places (or the whole region)
  destinations: Destination[];
  view?: "discover" | "map";
  featured?: CollectionModel[]; // candidates; which three show depends on where the visitor is
  popular?: PopularTitle[];
};

export function NearbyExplorer({ initial, cities, start, destinations, view = "discover", featured = [], popular = [] }: Props) {
  const cityOrigin = (id: string): Origin => originOf(findCity(cities, id) ?? start);
  const [origin, setOrigin] = useState<Origin>(() => originOf(start));
  const [radius, setRadius] = useState<Radius>(null);
  const [autoPicked, setAutoPicked] = useState(false); // radius chosen for the user's location, shown on the chip
  const [denied, setDenied] = useState(false); // location refused: Anywhere, with a small prompt
  const [chosen, setChosen] = useState(false); // the visitor set a start (location, city or search), not the default
  const [data, setData] = useState<NearbyResult | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useRef(0);
  const target = useRef<Origin>(origin); // the start last asked for (origin only changes once its data arrives)
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

  // auto: the server picked the radius (radius=auto) and says which one.
  const load = useCallback((next: Origin, query: string, auto = false) => {
    const id = ++requestId.current; // ignore answers to older requests
    target.current = next;
    setLoading(true);
    setMessage(null);
    fetchNearby(query)
      .then((json) => {
        if (id !== requestId.current) return;
        setOrigin(next);
        setData(json);
        if (auto) {
          setRadius((json as NearbyResult & { radius?: Radius }).radius ?? null);
          setAutoPicked(true);
        }
      })
      .catch(() => id === requestId.current && setMessage(LOAD_ERROR))
      .finally(() => id === requestId.current && setLoading(false));
  }, []);

  // The server could not prepare the first list: fetch it here instead.
  useEffect(() => {
    if (initial !== null) return;
    const id = requestId.current;
    fetchNearby(queryFor(cities, originOf(start), null))
      .then((json) => id === requestId.current && setData(json))
      .catch(() => id === requestId.current && setMessage(LOAD_ERROR))
      .finally(() => id === requestId.current && setLoading(false));
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps -- once, for the server's start

  // Without a start of the visitor's own: the host's IP location suggests the nearest city with
  // places (a hint only; nothing is stored and check-in never uses it).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("near") === "1") return;
    const id = requestId.current;
    fetch("/api/start")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { city: string | null; source: "ip" | "default" } | null) => {
        if (id !== requestId.current || !json?.city) return; // the visitor already picked something
        const c = findCity(cities, json.city);
        if (c && c.id !== start.id) load(originOf(c), queryFor(cities, originOf(c), null));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival

  const pickCity = (id: string) => {
    setAutoPicked(false);
    setChosen(true);
    load(cityOrigin(id), queryFor(cities, cityOrigin(id), radius));
  };

  const pickRadius = (r: Radius) => {
    setAutoPicked(false);
    setRadius(r);
    load(target.current, queryFor(cities, target.current, r));
  };

  // From search or popular titles: a title outside the radius widens to Anywhere first.
  const pickWork = (workId: string) => {
    if (!titles.some((t) => t.workId === workId) && radius !== null) pickRadius(null);
    showOnMap(workId);
  };

  const pickHit = (hit: SearchHit) => {
    if (hit.kind === "work") return pickWork(hit.id);
    if (!hit.centre) return;
    const next = { id: `at:${hit.kind}:${hit.id}`, label: hit.label, ...hit.centre };
    const r: Radius = hit.kind === "city" ? 25 : null; // a city: its surroundings; a country: everything, closest first
    setAutoPicked(false);
    setChosen(true);
    setRadius(r);
    load(next, queryFor(cities, next, r));
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const locateMe = () => {
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
        const me = { id: "me", label: "your location", lat: Number(lat), lng: Number(lng) };
        setDenied(false);
        setChosen(true);
        load(me, queryFor(cities, me, "auto"), true);
      },
      (err) => {
        setLocating(false);
        if (err.code !== err.PERMISSION_DENIED) return setMessage("Couldn't get your location. Pick a city instead.");
        setDenied(true);
        if (radius !== null) pickRadius(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  // From home: "Near me" (/discover?near=1) asks for the location once; the search
  // (/discover?at=lat,lng&label=…&kind=city|country) starts there.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || new URLSearchParams(window.location.search).get("near") !== "1") return;
    asked.current = true;
    locateMe();
  });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const [lat, lng] = (q.get("at") ?? "").split(",").map(Number);
    const kind = q.get("kind");
    if (asked.current || !q.get("at") || !Number.isFinite(lat) || !Number.isFinite(lng) || (kind !== "city" && kind !== "country")) return;
    asked.current = true;
    pickHit({ kind, id: q.get("label") ?? "", label: q.get("label") ?? "", places: 0, centre: { lat, lng } });
  });

  const onMapReady = () => {
    if (mapTracked.current) return;
    mapTracked.current = true;
    track("map_viewed", { origin: origin.id === "me" ? "my_location" : origin.id, places: data?.places.length ?? 0 });
  };

  const groups = data ? titlesByBand(data.titles) : [];
  // Covers in display order, no Commons file twice; featured collections avoid these too.
  const order = groups.flatMap((g) => g.titles);
  const titleCovers = distinctCovers(order.map((t) => t.poster ? [t.poster] : [t.closest.photo, ...places.filter((p) => p.workId === t.workId).map((p) => p.photo)]));
  const coverOf = new Map(order.map((t, i) => [t.workId, titleCovers[i]]));
  const watched = new Set(passport.watched);
  const isCity = !!findCity(cities, origin.id);
  const startCity = isCity ? origin.id : null;
  const tripFrom = isCity ? origin.id : `${origin.lat},${origin.lng}`;

  // Running number across all bands in the index ("01", "02", …).
  const offsets = groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.titles.length, 0));

  const isMap = view === "map";
  const searchExamples = [...new Set([popular[0]?.title ?? titles[0]?.title, destinations[0]?.city, REGION.country].filter((x): x is string => !!x))];
  // Featured scoring: "nearby" counts only once the visitor has set a start of their own.
  const featuredCtx = useMemo(() => ({ from: chosen ? { lat: origin.lat, lng: origin.lng } : null, radiusKm: radius }), [chosen, origin.lat, origin.lng, radius]);
  const empty = !!data && !loading && places.length === 0;
  return (
    <>
      <section id="discover" className={`scroll-mt-16 pt-8 sm:pt-12`}>
        <div className={WRAP}>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Filmed near <span className="text-accent">{origin.id === "me" ? "you" : origin.label}.</span>
            </h1>
            <CityPicker cities={cities} value={origin.id} customLabel={origin.label} locating={locating} onCity={pickCity} onMyLocation={locateMe} />
          </div>
          {!isMap && <div className="mt-6 max-w-2xl"><CatalogueSearch onPick={pickHit} examples={searchExamples} /></div>}
          <RadiusChips value={radius} auto={autoPicked} onPick={pickRadius} />
          {denied && (
            <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-ink/75">
              <span>Location is off. Showing {origin.label}.</span>
              <button type="button" onClick={locateMe} className="label inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline">
                Try again
              </button>
              <InfoTip label="Location help">If nothing happens, allow location for this site in your browser settings.</InfoTip>
            </p>
          )}
          {message && (
            <p role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-red-400">
              <span>{message}</span>
              {message === LOAD_ERROR && (
                <button type="button" onClick={() => load(target.current, queryFor(cities, target.current, radius))}
                  className="label inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline">Try again</button>
              )}
            </p>
          )}
          {empty && <EmptyNear radius={radius} onWider={pickRadius} />}
          <TitleChips titles={titles} colours={colours} selected={selected} onSelect={setSelected} />
        </div>

        <div className={`${WRAP} mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-20`}>
          <div ref={mapBox} className={`relative ${isMap ? "h-[68vh] max-h-[900px]" : "h-[56vh] max-h-[640px]"} min-h-[300px] scroll-mt-20 overflow-hidden -mx-4 sm:mx-0`}>
            <NearbyMap origin={origin} places={mapPlaces} focus={mapFocus} colours={colours} onReady={onMapReady} />
            <span aria-hidden className="pointer-events-none absolute left-3 top-3 z-[500] h-6 w-6 border-l-2 border-t-2 border-accent" />
            <span aria-hidden className="pointer-events-none absolute bottom-6 right-3 z-[500] h-6 w-6 border-b-2 border-r-2 border-accent" />
          </div>
          {destinations.length > 0 && (
            <aside>
              <h2 className="font-display text-2xl">Top cities</h2>
              <div className="mt-3">
                <Destinations items={destinations} current={origin.id} onPick={(id) => {
                  pickCity(id);
                  mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }} />
              </div>
            </aside>
          )}
        </div>
      </section>

      {!isMap && (<>
      <section id="index" aria-live="polite" aria-busy={loading}
        className={`scroll-mt-16 pb-20 pt-6 transition-opacity sm:pt-10 ${loading ? "opacity-60" : ""}`}>
        <div className={WRAP}>
          <h2 className="font-display text-4xl tracking-tight sm:text-6xl">Titles <span className="text-ink/40">· {radiusLabel(radius)}</span></h2>

          {empty && <div className="mt-8"><EmptyNear radius={radius} onWider={pickRadius} /></div>}
          {groups.map((g, gi) => (
            <div key={g.key} className="mt-12">
              <h3 className="flex items-baseline gap-3">
                <span className="label text-accent">{g.label}</span>
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
                        photo={coverOf.get(t.workId) ?? null}
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

      <FeaturedCollections collections={featured} ctx={featuredCtx} avoid={titleCovers.filter((p) => !!p)} />
      {popular.length > 0 && <PopularTitles titles={popular} onPick={pickWork} />}

      <PassportBar summary={passportSummary(passport.watched, data)} passportId={passport.id} sync={passport.sync} />
      </>)}
    </>
  );
}

/** "No verified locations within 10 km. Try 25 km or explore a collection." */
function EmptyNear({ radius, onWider }: { radius: Radius; onWider: (r: Radius) => void }) {
  const wider = widerRadius(radius);
  return (
    <div role="status" className="mt-4 border-l-2 border-accent bg-surface p-5">
      <p className="font-display text-xl text-ink sm:text-2xl">{emptyMessage(radius)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {wider !== undefined && (
          <button type="button" onClick={() => onWider(wider)}
            className="label inline-flex min-h-11 items-center bg-accent px-4 text-paper transition-colors hover:bg-ink">
            Try {radiusLabel(wider)}
          </button>
        )}
        <Link href="/collections" className="label inline-flex min-h-11 items-center border border-ink/30 px-4 transition-colors hover:border-accent hover:text-accent">
          Explore a collection
        </Link>
      </div>
    </div>
  );
}
