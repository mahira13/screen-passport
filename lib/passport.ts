import { CITIES } from "./cities";
import type { NearbyResult } from "./nearby";

export const MAX_WATCHED = 200;

/** What the browser keeps in localStorage. */
export interface LocalPassport {
  id: string | null;
  editKey: string | null;
  watched: string[];
  startCity: string | null;
}

export const EMPTY_PASSPORT: LocalPassport = { id: null, editKey: null, watched: [], startCity: null };

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Deduped, known work ids only, capped. Returns null if the input isn't a list of strings. */
export function cleanWatched(input: unknown, knownIds: Set<string>): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_WATCHED * 2) return null;
  if (!input.every((x) => typeof x === "string")) return null;
  return [...new Set(input as string[])].filter((id) => knownIds.has(id)).slice(0, MAX_WATCHED);
}

/** Only our own city ids are stored, never a user's coordinates. */
export function cleanStartCity(input: unknown): string | null {
  return typeof input === "string" && CITIES.some((c) => c.id === input) ? input : null;
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
      startCity: str(p.startCity),
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
