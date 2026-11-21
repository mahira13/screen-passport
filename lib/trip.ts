import { findCity } from "./cities";
import { formatDistance, haversineKm, parseLatLng } from "./distance";
import { joinNames, mainCity } from "./layla";
import type { LiveLocation } from "./nearby";
import { orderNearestNext, type TravelMode } from "./route";
import type { LatLng, Work } from "./types";

export type TripLength = "half" | "full";
export const TRIP_MODES: TravelMode[] = ["walk", "transit", "car"];
export const TRIP_LENGTHS: TripLength[] = ["half", "full"];
export const RADIUS_KM: Record<TravelMode, number> = { walk: 30, transit: 60, car: 150 };
export const MAX_STOPS: Record<TripLength, number> = { half: 5, full: 8 };
export const MAX_WORKS = 10;
export const MAX_JOINS = 50;
export const FIRST_NAME_MAX = 30;
export const TRIP_TIME_ZONE = "Europe/Berlin"; // all start cities are in Germany

export const MODE_LABEL: Record<TravelMode, string> = { walk: "On foot", transit: "Public transport", car: "By car" };
export const LENGTH_LABEL: Record<TripLength, string> = { half: "Half day", full: "Full day" };
const MODE_TITLE: Record<TravelMode, string> = { walk: "walk", transit: "day out", car: "road trip" };

export const isTravelMode = (x: unknown): x is TravelMode => TRIP_MODES.includes(x as TravelMode);
export const isTripLength = (x: unknown): x is TripLength => TRIP_LENGTHS.includes(x as TripLength);

export interface TripStart extends LatLng {
  label: string;
  param: string; // what goes back into ?from=
}

/** "berlin" or "52.520,13.405". Coordinates are rounded to about 100 m. */
export function parseFrom(raw: string | null | undefined): TripStart | null {
  if (!raw) return null;
  const city = findCity(raw);
  if (city) return { label: city.name, param: city.id, lat: city.lat, lng: city.lng };
  const [a, b, extra] = raw.split(",");
  if (extra !== undefined) return null;
  const p = parseLatLng(a, b);
  if (!p) return null;
  const lat = Number(p.lat.toFixed(3));
  const lng = Number(p.lng.toFixed(3));
  return { label: "your location", param: `${lat},${lng}`, lat, lng };
}

/** "dark,queens-gambit" -> ids, deduped, at most MAX_WORKS. */
export function parseWorkIds(raw: string | null | undefined): string[] {
  const ids = (raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^[\w-]{1,80}$/.test(s));
  return [...new Set(ids)].slice(0, MAX_WORKS);
}

export interface TripStop extends LatLng {
  id: number;
  workId: string;
  title: string;
  name: string;
  city: string | null;
  sceneNote: string | null;
  visitNote: string | null;
  kmFromPrevious: number;
}

/**
 * The chosen works' live locations within the mode's radius of the start,
 * ordered nearest-next-stop, cut to the length's maximum.
 */
export function selectTripStops(
  locations: LiveLocation[],
  works: Work[],
  workIds: string[],
  start: LatLng,
  mode: TravelMode,
  length: TripLength,
): TripStop[] {
  const titles = new Map(works.map((w) => [w.id, w.title]));
  const inRange = locations.flatMap((l) => {
    if (l.lat === null || l.lng === null || !workIds.includes(l.work_id) || !titles.has(l.work_id)) return [];
    const p = { lat: l.lat, lng: l.lng };
    if (haversineKm(start, p) > RADIUS_KM[mode]) return [];
    return [{
      id: l.id, workId: l.work_id, title: titles.get(l.work_id)!, name: l.name, city: l.city, ...p,
      sceneNote: l.scene_note ?? null, visitNote: l.visit_note ?? null,
    }];
  });
  return orderNearestNext(start, inRange)
    .slice(0, MAX_STOPS[length])
    .map((s) => ({ ...s, kmFromPrevious: Math.round(s.kmFromPrevious * 10) / 10 }));
}

/** Where the closest place of the chosen works is, for "The nearest are in <city>". */
export function nearestCity(locations: LiveLocation[], workIds: string[], start: LatLng): string | null {
  let best: { km: number; label: string } | null = null;
  for (const l of locations) {
    if (l.lat === null || l.lng === null || !workIds.includes(l.work_id)) continue;
    const km = haversineKm(start, { lat: l.lat, lng: l.lng });
    if (!best || km < best.km) best = { km, label: mainCity(l.city) ?? l.name };
  }
  return best?.label ?? null;
}

// ---- The plan (written by Claude, or built in code as a fallback) ----

export interface PlanStop {
  location_id: number;
  time: string | null;
  travel_from_previous: string;
  why_fans_love_it: string | null;
}

export interface TripPlan {
  source: "claude" | "code";
  title: string;
  intro: string | null;
  stops: PlanStop[];
  tips: string[];
}

/** Exactly what Claude sees: the selected stops, nothing else from the database. */
export function claudeInput(stops: TripStop[]) {
  return stops.map((s) => ({
    location_id: s.id,
    name: s.name,
    title: s.title,
    scene_note: s.sceneNote,
    visit_note: s.visitNote,
    km_from_previous: s.kmFromPrevious,
  }));
}

const str = (x: unknown, max: number): string | null =>
  typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null;

/**
 * Accepts Claude's answer only if it lists every input stop once, in the given
 * order, and no other location IDs. Returns null otherwise (caller retries).
 */
export function validatePlan(raw: unknown, stops: TripStop[]): TripPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 120);
  if (!title || !Array.isArray(r.stops) || r.stops.length !== stops.length) return null;
  const planStops: PlanStop[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = r.stops[i] as Record<string, unknown> | null;
    if (!s || typeof s !== "object" || s.location_id !== stops[i].id) return null;
    planStops.push({
      location_id: stops[i].id,
      time: str(s.time, 20),
      travel_from_previous: str(s.travel_from_previous, 160) ?? travelStep(stops[i].kmFromPrevious, i === 0),
      why_fans_love_it: str(s.why_fans_love_it, 300),
    });
  }
  const tips = Array.isArray(r.tips) ? r.tips.map((t) => str(t, 200)).filter((t): t is string => !!t).slice(0, 5) : [];
  return { source: "claude", title, intro: str(r.intro, 600), stops: planStops, tips };
}

export function travelStep(km: number, first: boolean): string {
  return `${formatDistance(km)} from ${first ? "the start" : "the last stop"}`;
}

/** Plain plan without descriptions, used when Claude fails twice or isn't configured. */
export function codePlan(stops: TripStop[], start: TripStart, mode: TravelMode): TripPlan {
  const titles = [...new Set(stops.map((s) => s.title))];
  const named = titles.length > 1 ? `${titles[0]} and ${titles.length - 1} more` : (titles[0] ?? "Filming places");
  return {
    source: "code",
    title: `${named} ${MODE_TITLE[mode]} from ${start.label === "your location" ? "here" : start.label}`.slice(0, 120),
    intro: null,
    stops: stops.map((s, i) => ({
      location_id: s.id, time: null, travel_from_previous: travelStep(s.kmFromPrevious, i === 0), why_fans_love_it: null,
    })),
    tips: [],
  };
}

// ---- Form input ----

/** First name only: letters, spaces, hyphens, apostrophes; 1–30 characters. Rejects emails and numbers. */
export function validateFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > FIRST_NAME_MAX) return null;
  return /^\p{L}[\p{L}\p{M} '’.-]*$/u.test(name) ? name : null;
}

/** ISO date from the form: not more than an hour in the past, at most a year ahead. */
export function parseStartsAt(raw: unknown, now = new Date()): Date | null {
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  if (t < now.getTime() - 3600_000 || t > now.getTime() + 366 * 86400_000) return null;
  return d;
}

/** "Sat 28 Nov, 10:00" in Berlin time. */
export function formatTripDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TRIP_TIME_ZONE,
  }).format(new Date(iso));
}

/** "Sat 28 Nov" in Berlin time. */
export function formatTripDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TRIP_TIME_ZONE })
    .format(new Date(iso));
}

export function shareText(title: string, iso: string, link: string): string {
  return `Join me on ${title} on ${formatTripDay(iso)}: ${link}`;
}

/** Prompt copied for Layla: travel and stays around the trip's stops. */
export function tripLaylaPrompt(iso: string, stops: { name: string; city: string | null; title: string }[]): string {
  const cities = [...new Set(stops.map((s) => mainCity(s.city)).filter((c): c is string => !!c))];
  const titles = [...new Set(stops.map((s) => s.title))];
  const where = cities.length ? ` in ${joinNames(cities.slice(0, 3))}` : "";
  return `Plan travel and a place to stay for ${formatTripDay(iso)}${where}. I'm visiting ${joinNames(
    stops.slice(0, 5).map((s) => s.name),
  )} where ${joinNames(titles.slice(0, 3))} ${titles.length === 1 ? "was" : "were"} filmed.`;
}
