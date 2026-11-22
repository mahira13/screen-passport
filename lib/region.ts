// Launch scope: which country the catalogue covers. The only place the country is named; the
// pipeline (Wikidata, Nominatim, verification) and the "Anywhere" fallback read it from here.
import type { LatLng } from "./types";

export const REGION = {
  countryCode: "DE",
  country: "Germany",
  wikidataQid: "Q183",
  tz: "Europe/Berlin",
  centre: { lat: 51.163, lng: 10.448 } as LatLng, // geographic centre, for an empty catalogue
} as const;

/** IANA time zone per country code, for trip times. Unknown countries use the region's. */
const COUNTRY_TZ: Record<string, string> = { DE: "Europe/Berlin", AT: "Europe/Vienna", CH: "Europe/Zurich" };

export const tzForCountry = (code: string | null | undefined) => COUNTRY_TZ[(code ?? "").toUpperCase()] ?? REGION.tz;

export const inRegion = (code: string | null | undefined) => (code ?? "").toUpperCase() === REGION.countryCode;
