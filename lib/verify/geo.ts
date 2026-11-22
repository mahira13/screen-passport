// Reading a Nominatim result for the verification pipeline. Pure functions; the request is in run.ts.
import type { NominatimHit } from "../geocode";

export type GeoKind = "poi" | "area" | "residential" | "unmatched";

export interface GeoCheck {
  kind: GeoKind;
  nameMatch: boolean;
  cityMatch: boolean;
  countryMatch: boolean;
  bbox: [number, number, number, number] | null; // south, west, north, east
}

const fold = (s: string) => s.toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "");
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

// Words that name a kind of place, not a particular one: sharing only these proves nothing.
const GENERIC = new Set([
  "the", "and", "der", "die", "das", "und", "von", "bei", "am", "an", "im", "berlin", "berliner",
  "rathaus", "bahnhof", "station", "kirche", "church", "platz", "square", "strasse", "street", "bridge", "brucke",
  "airport", "flughafen", "park", "museum", "hall", "halle", "haus", "house", "school", "schule", "hotel",
  "theater", "theatre", "markt", "market", "tram", "stop", "former", "ehemalige", "alte", "alter", "altes", "old", "new", "neue",
]);

/** Same place name? Equal after folding, one contains the other, or they share a distinctive word. */
export function namesMatch(a: string, b: string, city?: string | null): boolean {
  const [fa, fb] = [words(a).join(" "), words(b).join(" ")];
  if (!fa || !fb) return false;
  if (fa === fb || fa.includes(fb) || fb.includes(fa)) return true;
  const skip = new Set([...GENERIC, ...(city ? words(city) : [])]);
  const wb = new Set(words(b));
  return words(a).some((w) => w.length >= 4 && !skip.has(w) && wb.has(w));
}

const POI_CLASSES = new Set(["tourism", "historic", "amenity", "building", "leisure", "man_made", "railway", "aeroway", "office", "shop", "club"]);
const RESIDENTIAL_TYPES = new Set(["house", "residential", "apartments", "detached", "terrace", "semidetached_house", "bungalow", "dormitory"]);
const AREA_CLASSES = new Set(["highway", "boundary", "place", "landuse", "natural", "waterway"]);

function cityOf(hit: NominatimHit): string | null {
  const a = hit.address ?? {};
  return a.city ?? a.town ?? a.village ?? a.municipality ?? null;
}

/** What kind of match this is, and whether name, city and country fit the claimed location. */
export function classifyGeocode(hit: NominatimHit, locationName: string, locationCity: string | null): GeoCheck {
  const name = hit.name ?? hit.address?.[hit.addresstype ?? ""] ?? null;
  const nameMatch = !!name && namesMatch(locationName, name, locationCity);
  const hitCity = cityOf(hit);
  const cities = (locationCity ?? "").split("/").map((c) => fold(c).trim()).filter(Boolean);
  const cityMatch = !cities.length || (!!hitCity && cities.some((c) => fold(hitCity) === c || fold(hitCity).startsWith(c) || c.startsWith(fold(hitCity))));
  const countryMatch = (hit.address?.country_code ?? "de").toLowerCase() === "de";
  const bb = hit.boundingbox?.map(Number);
  const bbox = bb && bb.length === 4 && bb.every(Number.isFinite) ? ([bb[0], bb[2], bb[1], bb[3]] as GeoCheck["bbox"]) : null;

  const residential = RESIDENTIAL_TYPES.has(hit.type ?? "") && (hit.category === "building" || hit.category === "place")
    || (!hit.name && (hit.addresstype === "house" || hit.addresstype === "building"));
  let kind: GeoKind;
  if (residential) kind = "residential";
  else if (!nameMatch) kind = AREA_CLASSES.has(hit.category ?? "") && !name ? "area" : "unmatched";
  else if (POI_CLASSES.has(hit.category ?? "")) kind = "poi";
  else kind = "area";
  return { kind, nameMatch, cityMatch, countryMatch, bbox };
}
