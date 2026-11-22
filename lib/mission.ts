// Mission (collection) difficulty and scene labels, from real place data only. Pure.
import { formatDistance, haversineKm } from "./distance";

export const MISSION_MIN_CHECKINS = 2; // fewer check-in places → "Coming soon"
const WALK_M_PER_MIN = 80; // about 4.8 km/h, straight line

type Place = { id: number; lat: number; lng: number; city: string | null; checkIn: boolean };
export type Level = "Easy" | "Medium" | "Hard" | "Epic";

export type MissionInfo = {
  scenes: number;
  checkIns: number;
  cities: number;
  spreadKm: number;
  reels: 1 | 2 | 3 | 4 | 5;
  level: Level;
  line: string; // "Easy · 3 scenes · 2 km", "Epic · 12 scenes · 4 cities"
  locked: boolean;
};

/** The widest straight-line distance between any two places. */
export function spreadKm(places: Pick<Place, "lat" | "lng">[]): number {
  let max = 0;
  for (let i = 0; i < places.length; i++)
    for (let j = i + 1; j < places.length; j++) max = Math.max(max, haversineKm(places[i], places[j]));
  return max;
}

const step = (x: number, limits: number[]) => {
  const i = limits.findIndex((l) => x <= l);
  return i === -1 ? limits.length + 1 : i + 1;
};

export function missionInfo(all: Place[]): MissionInfo {
  const places = [...new Map(all.map((p) => [p.id, p])).values()];
  const scenes = places.length;
  const cities = new Set(places.map((p) => p.city).filter(Boolean)).size;
  const spread = spreadKm(places);
  const bySize = step(scenes, [3, 5, 8, 11]);
  const bySpread = step(spread, [3, 10, 30, 250]);
  const reels = Math.min(5, Math.max(1, Math.round((bySize + bySpread) / 2))) as MissionInfo["reels"];
  const level: Level = reels <= 2 ? "Easy" : reels === 3 ? "Medium" : reels === 4 ? "Hard" : "Epic";
  const count = `${scenes} ${scenes === 1 ? "scene" : "scenes"}`;
  const reach = cities > 1 ? `${cities} cities` : spread < 1 ? "under 1 km" : `${Math.round(spread)} km`;
  const checkIns = places.filter((p) => p.checkIn).length;
  return { scenes, checkIns, cities, spreadKm: spread, reels, level, line: `${level} · ${count} · ${reach}`, locked: checkIns < MISSION_MIN_CHECKINS };
}

/** "8 min walk" up to half an hour on foot, else "about 12 km". */
export function walkLabel(km: number): string {
  const min = Math.max(1, Math.round((km * 1000) / WALK_M_PER_MIN));
  return min <= 30 ? `${min} min walk` : formatDistance(km);
}

export const sceneNumber = (index: number) => `Scene ${String(index + 1).padStart(2, "0")}`;
