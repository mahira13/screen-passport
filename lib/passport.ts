import type { City } from "./cities";
import { canCheckIn } from "./distance";
import type { LiveLocation, NearbyResult } from "./nearby";

export const MAX_WATCHED = 200;
export const MAX_VISITED = 500;

/** What the browser keeps in localStorage. */
export interface LocalPassport {
  id: string | null;
  editKey: string | null;
  watched: string[];
  visited: number[]; // location ids checked in on site
  startCity: string | null;
  stampedAt: Record<string, string>; // location id → check-in day (YYYY-MM-DD); this device only, never sent
}

export const EMPTY_PASSPORT: LocalPassport = { id: null, editKey: null, watched: [], visited: [], startCity: null, stampedAt: {} };

const isPlaceId = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Deduped, known work ids only, capped. Returns null if the input isn't a list of strings. */
export function cleanWatched(input: unknown, knownIds: Set<string>): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_WATCHED * 2) return null;
  if (!input.every((x) => typeof x === "string")) return null;
  return [...new Set(input as string[])].filter((id) => knownIds.has(id)).slice(0, MAX_WATCHED);
}

/** Places where check-in is allowed: coordinates from the source or checked by a human. */
export function checkInIds(locations: LiveLocation[]): Set<number> {
  return new Set(locations.filter(canCheckIn).map((l) => l.id));
}

/**
 * Deduped place ids that allow check-in, capped. Places already in the passport stay even if
 * they are no longer eligible (e.g. unpublished for a fix). Null if the input isn't a list of ids.
 */
export function cleanVisited(input: unknown, eligible: Set<number>, stored: number[]): number[] | null {
  if (!Array.isArray(input) || input.length > MAX_VISITED * 2 || !input.every(isPlaceId)) return null;
  const kept = new Set(stored);
  return [...new Set(input)].filter((id) => eligible.has(id) || kept.has(id)).slice(0, MAX_VISITED);
}

/** Only our own city ids are stored, never a user's coordinates. */
export function cleanStartCity(input: unknown, cities: City[]): string | null {
  return typeof input === "string" && cities.some((c) => c.id === input) ? input : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Only "<place id>": "YYYY-MM-DD" pairs survive. */
export function cleanStampDates(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([k, v]) => isPlaceId(Number(k)) && typeof v === "string" && DAY.test(v)));
}

/** Reads localStorage JSON defensively; anything odd becomes an empty passport. */
export function parseLocalPassport(raw: string | null): LocalPassport {
  if (!raw) return EMPTY_PASSPORT;
  try {
    const p = JSON.parse(raw);
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      id: str(p.id),
      editKey: str(p.editKey),
      watched: Array.isArray(p.watched) ? p.watched.filter((x: unknown) => typeof x === "string") : [],
      visited: Array.isArray(p.visited) ? [...new Set<number>(p.visited.filter(isPlaceId))] : [],
      startCity: str(p.startCity),
      stampedAt: cleanStampDates(p.stampedAt),
    };
  } catch {
    return EMPTY_PASSPORT;
  }
}

export interface PassportSummary {
  titles: number;
  places: number;
  closestKm: number | null;
}

/** "3 titles · 18 places · closest about 0.3 km", from the places currently live. */
export function passportSummary(watched: string[], nearby: NearbyResult | null): PassportSummary {
  const set = new Set(watched);
  // A place filmed for two watched titles appears once per title: count it once.
  const mine = [...new Map((nearby?.places ?? []).filter((p) => set.has(p.workId)).map((p) => [p.id, p])).values()];
  return {
    titles: set.size,
    places: mine.length,
    closestKm: mine.length ? Math.min(...mine.map((p) => p.distanceKm)) : null,
  };
}
