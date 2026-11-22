import { startedCollections } from "./collections";
import { formatDistance } from "./distance";
import type { NearbyPlace } from "./nearby";
import type { Collection } from "./types";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
export const MAX_STAMPS = 6;
export const MAP_RADIUS_KM = 60;

// Readable on navy (#16213A): every colour has contrast above 4.5:1.
export const TITLE_COLOURS = ["#E3B04B", "#F4EFE4", "#7FB8E6", "#F28C7C", "#9BD39B", "#C7A6F0"];

export interface CardStamp {
  title: string;
  places: number;
  visited: boolean;
  colour: string;
}

export interface CardDot {
  lat: number;
  lng: number;
  colour: string;
}

export interface CardData {
  cityName: string;
  displayName: string | null;
  placeCount: number;
  stamps: CardStamp[]; // at most MAX_STAMPS slots, including the "+N more" circle
  moreStamps: number; // titles that did not fit
  dots: CardDot[];
  closest: string | null; // "Closest: Rotes Rathaus (Babylon Berlin), about 0.3 km"
  collection: string | null; // "Cold War Berlin 2/4"
}

export interface StampInput {
  workId: string;
  title: string;
  places: NearbyPlace[];
  visited: boolean;
}

export function buildCardData(input: {
  cityName: string;
  displayName: string | null;
  stamps: StampInput[];
  collections: Collection[];
}): CardData {
  const colourOf = new Map(input.stamps.map((s, i) => [s.workId, TITLE_COLOURS[i % TITLE_COLOURS.length]]));
  // One entry per physical place, even when it was filmed for several of these titles.
  const places = [...new Map(input.stamps.flatMap((s) => s.places).map((p) => [p.id, p])).values()]
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const closest = places[0];
  // Six slots: with more titles, five stamps and a "+N more" circle.
  const shown = input.stamps.length > MAX_STAMPS ? MAX_STAMPS - 1 : input.stamps.length;
  const collection = startedCollections(input.collections, input.stamps.map((s) => s.workId))[0];
  return {
    cityName: input.cityName,
    displayName: input.displayName,
    placeCount: places.length,
    stamps: input.stamps.slice(0, shown).map((s) => ({
      title: s.title,
      places: s.places.length,
      visited: s.visited,
      colour: colourOf.get(s.workId)!,
    })),
    moreStamps: input.stamps.length - shown,
    dots: mapPlaces(places).map((p) => ({ lat: p.lat, lng: p.lng, colour: colourOf.get(p.workId)! })),
    closest: closest ? `Closest: ${closest.name} (${closest.title}), ${formatDistance(closest.distanceKm)}` : null,
    collection: collection?.label ?? null,
  };
}

/** Keeps the map local: places within MAP_RADIUS_KM if there are at least 2, else all. */
export function mapPlaces(places: NearbyPlace[]): NearbyPlace[] {
  const near = places.filter((p) => p.distanceKm <= MAP_RADIUS_KM);
  return near.length >= 2 ? near : places;
}

/** Flat projection that keeps shapes right at German latitudes, fitted into the box. */
export function projectDots(dots: CardDot[], width: number, height: number, pad: number) {
  if (dots.length === 0) return [];
  const k = Math.cos((dots.reduce((s, d) => s + d.lat, 0) / dots.length) * (Math.PI / 180));
  const xs = dots.map((d) => d.lng * k);
  const ys = dots.map((d) => -d.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(spanX ? (width - 2 * pad) / spanX : Infinity, spanY ? (height - 2 * pad) / spanY : Infinity);
  const s = Number.isFinite(scale) ? scale : 0;
  const offX = (width - spanX * s) / 2;
  const offY = (height - spanY * s) / 2;
  return dots.map((d, i) => ({ x: offX + (xs[i] - minX) * s, y: offY + (ys[i] - minY) * s, colour: d.colour }));
}

export function shareText(placeCount: number, cityName: string, link: string): string {
  return `My Screen Passport: ${placeCount} ${placeCount === 1 ? "place" : "places"} from my films near ${cityName}. Find yours: ${link}`;
}
