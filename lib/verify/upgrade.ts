// Upgrading an approximate pin to geocoded_poi (check-in grade). Pure; the network calls are in
// scripts/upgrade-coords.ts. Rules: a trusted source names the exact place (quote found by code on
// the fetched page), Nominatim returns a named landmark whose name and city match, and that landmark
// agrees with the stored pin (within 200 m, or the pin lies inside its outline). Anything else stays
// approximate: never guess.
import { haversineKm } from "../distance";
import type { NominatimHit } from "../geocode";
import type { LatLng } from "../types";
import type { GeoCheck } from "./geo";
import { classifyGeocode, GENERIC, words } from "./geo";
import { MAX_QUOTE_WORDS } from "./text";

export const AGREE_M = 200;

/**
 * The distinctive words of a place's main name (before any comma or bracket), e.g.
 * "Schloss Börnicke" → schloss, bornicke; "Reinfelder Schule" → reinfelder. City words and
 * generic words (school, church, …) don't count.
 */
export function mainNameWords(placeName: string, city: string | null): string[] {
  const main = placeName.split(/[,(]/)[0];
  const skip = new Set([...GENERIC, ...(city ? words(city) : [])]);
  const distinctive = words(main).filter((w) => w.length >= 4 && !skip.has(w));
  return distinctive.length ? distinctive : words(main).filter((w) => !skip.has(w));
}

/** True when the text contains every distinctive word of the place's main name. */
export function namesPlace(text: string, placeName: string, city: string | null): boolean {
  const need = mainNameWords(placeName, city);
  const have = new Set(words(text));
  return need.length > 0 && need.every((w) => have.has(w));
}

/** True when the text names the place by its name or one of its aliases (e.g. its German name). */
export function namesAny(text: string, names: string[], city: string | null): boolean {
  return names.some((n) => namesPlace(text, n, city));
}

/** The geocoder result read against the name and each alias; the first that matches wins. */
export function classifyAny(hit: NominatimHit, names: string[], city: string | null): GeoCheck {
  const checks = names.map((n) => classifyGeocode(hit, n, city));
  return checks.find((c) => c.nameMatch) ?? checks[0];
}

/** A passage from the page that names the place (by name or alias), at most 25 words. */
export function findPlaceQuote(pageText: string, placeName: string | string[], city: string | null): string | null {
  const names = Array.isArray(placeName) ? placeName : [placeName];
  for (const s of pageText.split(/(?<=[.!?])\s+/)) {
    const ws = s.split(/\s+/).filter(Boolean);
    // Slide a window so long sentences still give a short, exact quote.
    for (let i = 0; i < Math.max(1, ws.length - 3); i += 5) {
      const window = ws.slice(i, i + MAX_QUOTE_WORDS).join(" ");
      if (namesAny(window, names, city)) return window;
    }
  }
  return null;
}

const inBox = (p: LatLng, b: GeoCheck["bbox"]) => !!b && p.lat >= b[0] && p.lat <= b[2] && p.lng >= b[1] && p.lng <= b[3];

// Rule 7: no closed studio sets. A scene shot inside a studio can't be visited, whatever the building.
const STUDIO = /\bstudio\b|sound ?stage|film set|studio set/i;

export type UpgradeInput = {
  name: string;
  aliases?: string[];
  city: string | null;
  old: LatLng;
  trusted: boolean;
  quote: string | null;
  hit: NominatimHit | null;
  geo: GeoCheck | null;
  sceneNotes: string[];
};
export type Upgrade = {
  upgrade: boolean;
  newPoint: LatLng | null;
  distanceM: number | null; // old pin → geocoder result
  reasons: string[]; // why not, or notes
  removeFromChallenge: boolean; // private home or closed studio set
};

export function decideUpgrade(u: UpgradeInput): Upgrade {
  const newPoint = u.hit ? { lat: Number(u.hit.lat), lng: Number(u.hit.lon) } : null;
  const distanceM = newPoint ? Math.round(haversineKm(u.old, newPoint) * 1000) : null;
  const reasons: string[] = [];
  let removeFromChallenge = false;

  if (u.geo?.kind === "residential") {
    reasons.push("possible private home");
    removeFromChallenge = true;
  }
  if (u.sceneNotes.some((n) => STUDIO.test(n))) {
    reasons.push("filmed inside a studio, which visitors can't enter");
    removeFromChallenge = true;
  }
  if (!u.trusted) reasons.push("source domain not trusted");
  if (!u.quote) reasons.push("source page doesn't name the exact place");
  if (!u.hit || !u.geo) reasons.push("no geocoder match");
  else {
    if (u.geo.kind !== "poi") reasons.push(`geocoder found ${u.geo.kind === "unmatched" ? "a different place" : "an area, not a landmark"}`);
    const names = [u.name, ...(u.aliases ?? [])];
    const aliasMatch = !!u.aliases?.length && namesAny(u.hit.name ?? "", u.aliases, u.city);
    if (!(u.geo.nameMatch || aliasMatch) || !namesAny(u.hit.name ?? "", names, u.city)) reasons.push(`geocoder name (“${u.hit.name ?? "none"}”) doesn't match`);
    if (!u.geo.cityMatch) reasons.push("geocoder city doesn't match");
    if (!u.geo.countryMatch) reasons.push("not in Germany");
    if (newPoint && distanceM! > AGREE_M && !inBox(u.old, u.geo.bbox)) reasons.push(`landmark is ${distanceM} m from the stored pin (more than ${AGREE_M} m, outside its outline)`);
  }
  return { upgrade: reasons.length === 0, newPoint, distanceM, reasons, removeFromChallenge };
}
