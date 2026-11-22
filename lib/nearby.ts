import { BANDS, distanceBand, parseOutline, sortByDistance, type BandKey, type BBox, type Outline } from "./distance";
import type { CoordQuality, FilmLocation, LatLng, Work } from "./types";

export type LiveLocation = Pick<
  FilmLocation,
  "id" | "work_id" | "name" | "city" | "lat" | "lng" | "coord_quality"
> &
  Partial<Pick<FilmLocation, "scene_note" | "visit_note" | "source_name" | "source_url">> &
  // From catalogue_entries (migrations 007–008); missing before they are applied.
  Partial<Pick<FilmLocation, "address" | "region" | "country" | "country_code" | "location_confidence" | "public_access" | "depicts" | "verification_method">> &
  { bbox_south?: number | null; bbox_west?: number | null; bbox_north?: number | null; bbox_east?: number | null } &
  // Migration 009: only filled when the photo is auto-matched or approved.
  { image_thumb_url?: string | null; image_author?: string | null; image_license?: string | null;
    image_license_url?: string | null; image_source_page?: string | null } &
  // Migration 013: the site outline for check-in at large landmarks.
  { check_in_area?: unknown };

/** A Wikimedia Commons photo with its credit. */
export type Photo = { url: string; author: string; license: string; licenseUrl: string | null; page: string; kind?: "poster" };

export function photoOf(l: LiveLocation): Photo | null {
  if (!l.image_thumb_url || !l.image_source_page) return null;
  return { url: l.image_thumb_url, author: l.image_author ?? "Unknown author", license: l.image_license ?? "", licenseUrl: l.image_license_url ?? null, page: l.image_source_page };
}

/** A collection's cover: the first place with a photo (titles in order, lowest id first), or none. */
export function coverPhoto(workIds: string[], locations: LiveLocation[]): Photo | null {
  for (const w of workIds) {
    const first = locations.filter((l) => l.work_id === w && photoOf(l)).sort((a, b) => a.id - b.id)[0];
    if (first) return photoOf(first);
  }
  return null;
}

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
  bbox: BBox | null; // large sites: check-in anywhere inside
  outline: Outline | null; // OSM site outline; replaces the bbox for check-in when present
  verifiedBy: "ai" | "team" | null;
  photo: Photo | null;
}

export interface NearbyTitle {
  workId: string;
  title: string;
  type: Work["type"];
  year: number | null;
  poster: Photo | null;
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
      bbox: l.bbox_south != null && l.bbox_west != null && l.bbox_north != null && l.bbox_east != null
        ? [l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east] : null,
      outline: parseOutline(l.check_in_area),
      verifiedBy: l.verification_method ?? null,
      photo: photoOf(l),
    }));

  const titles = new Map<string, NearbyTitle>();
  for (const p of places) {
    const t = titles.get(p.workId);
    if (t) t.placeCount++;
    else titles.set(p.workId, { workId: p.workId, title: p.title, type: byId.get(p.workId)!.type, year: byId.get(p.workId)!.year ?? null, poster: byId.get(p.workId)!.poster ?? null, placeCount: 1, closest: p });
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
