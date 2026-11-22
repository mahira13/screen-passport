import { BANDS, distanceBand, sortByDistance, type BandKey } from "./distance";
import type { CoordQuality, FilmLocation, LatLng, Work } from "./types";

export type LiveLocation = Pick<
  FilmLocation,
  "id" | "work_id" | "name" | "city" | "lat" | "lng" | "coord_quality"
> &
  Partial<Pick<FilmLocation, "scene_note" | "visit_note" | "source_name" | "source_url">> &
  // From catalogue_entries (migration 007); missing before it is applied.
  Partial<Pick<FilmLocation, "country" | "country_code" | "location_confidence" | "public_access" | "depicts">>;

export interface NearbyPlace {
  id: number;
  workId: string;
  title: string;
  name: string;
  city: string | null;
  lat: number;
  lng: number;
  coordQuality: CoordQuality | null;
  distanceKm: number;
  band: BandKey;
  sceneNote: string | null;
  visitNote: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface NearbyTitle {
  workId: string;
  title: string;
  type: Work["type"];
  placeCount: number;
  closest: NearbyPlace;
}

export interface NearbyResult {
  places: NearbyPlace[]; // closest first
  titles: NearbyTitle[]; // by closest place
}

/** Sorts live locations by distance and groups them by title. Rows without coordinates are skipped. */
export function buildNearby(locations: LiveLocation[], works: Work[], from: LatLng): NearbyResult {
  const byId = new Map(works.map((w) => [w.id, w]));
  const places: NearbyPlace[] = sortByDistance(locations, from)
    .filter((l) => byId.has(l.work_id))
    .map((l) => ({
      id: l.id,
      workId: l.work_id,
      title: byId.get(l.work_id)!.title,
      name: l.name,
      city: l.city,
      lat: l.lat,
      lng: l.lng,
      coordQuality: l.coord_quality,
      distanceKm: Math.round(l.distanceKm * 100) / 100,
      band: distanceBand(l.distanceKm).key,
      sceneNote: l.scene_note ?? null,
      visitNote: l.visit_note ?? null,
      sourceName: l.source_name ?? null,
      sourceUrl: l.source_url ?? null,
    }));

  const titles = new Map<string, NearbyTitle>();
  for (const p of places) {
    const t = titles.get(p.workId);
    if (t) t.placeCount++;
    else titles.set(p.workId, { workId: p.workId, title: p.title, type: byId.get(p.workId)!.type, placeCount: 1, closest: p });
  }
  return { places, titles: [...titles.values()] };
}

/** Title cards under band headings ("Near you", "Day trip", ...), empty bands left out. */
export function titlesByBand(titles: NearbyTitle[]) {
  return BANDS.map((b) => ({ key: b.key, label: b.label, titles: titles.filter((t) => t.closest.band === b.key) })).filter(
    (g) => g.titles.length > 0,
  );
}

/** Places the map should show at first: everything within 30 km, or at least the closest 3. */
export function initialMapPlaces(places: NearbyPlace[]): NearbyPlace[] {
  const near = places.filter((p) => p.distanceKm <= 30);
  return near.length >= 3 ? near : places.slice(0, 3);
}

/** Markers to draw: one title when a filter is set (and still present), else all. */
export function visiblePlaces(places: NearbyPlace[], selected: string | null): NearbyPlace[] {
  const only = selected ? places.filter((p) => p.workId === selected) : [];
  return only.length ? only : places;
}

/** What the map zooms to: all of a filtered title's places, else the usual first view. */
export function focusPlaces(places: NearbyPlace[], selected: string | null): NearbyPlace[] {
  const only = selected ? places.filter((p) => p.workId === selected) : [];
  return only.length ? only : initialMapPlaces(places);
}
