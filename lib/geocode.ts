// Reading Nominatim results. Network calls live in scripts/geocode.ts.

export interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  category?: string; // jsonv2, e.g. "amenity", "boundary", "highway"
  type?: string; // e.g. "school", "administrative", "residential"
  addresstype?: string; // e.g. "amenity", "suburb", "road", "city"
  name?: string;
  boundingbox?: string[]; // [south, north, west, east] as strings
  address?: Record<string, string>; // with addressdetails=1
}

// Areas and streets, not a single place: too vague to stand for a location.
const COARSE = new Set([
  "city", "town", "village", "hamlet", "municipality", "county", "state", "region",
  "district", "city_district", "borough", "suburb", "quarter", "neighbourhood",
  "administrative", "postcode", "road",
]);

/** "amenity/school (amenity)": category/type, plus addresstype when present. */
export function placeType(hit: NominatimHit): string {
  const base = [hit.category, hit.type].filter(Boolean).join("/") || "unknown";
  return hit.addresstype ? `${base} (${hit.addresstype})` : base;
}

/** True for districts, suburbs, cities and roads: fix these by hand. */
export function isCoarse(hit: NominatimHit): boolean {
  if (hit.category === "highway" || hit.category === "boundary") return true;
  if (hit.category === "place" && hit.type && COARSE.has(hit.type)) return true;
  return hit.addresstype !== undefined && COARSE.has(hit.addresstype);
}
