// Data for the public title and location pages, built from the live (published) rows. Pure functions.
import { canCheckIn } from "./distance";
import { buildNearby, photoOf, type LiveLocation, type NearbyPlace, type Photo } from "./nearby";
import type { LocationConfidence, PublicAccess, Work } from "./types";

export type TitlePlace = { id: number; name: string; city: string | null; sceneNote: string | null; depicts: string | null; lat: number; lng: number; photo: Photo | null };
export type CityGroup = { city: string; places: TitlePlace[] };
export type CountryGroup = { country: string; cities: CityGroup[]; count: number };
export type TitlePage = { work: Work; places: TitlePlace[]; countries: CountryGroup[]; mainCity: string | null };

/** Groups by key, biggest group first, then by name. */
function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

/** A title with every published place, grouped by country and city (most places first). Null if unknown or without places. */
export function titlePage(workId: string, works: Work[], locations: LiveLocation[]): TitlePage | null {
  const work = works.find((w) => w.id === workId);
  if (!work) return null;
  const rows = [...new Map(locations
    .filter((l) => l.work_id === workId && l.lat != null && l.lng != null)
    .map((l) => [l.id, l])).values()];
  if (!rows.length) return null;
  const place = (l: LiveLocation): TitlePlace => ({
    id: l.id, name: l.name, city: l.city, sceneNote: l.scene_note ?? null, depicts: l.depicts ?? null,
    lat: l.lat!, lng: l.lng!, photo: photoOf(l),
  });
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const countries = groupBy(sorted, (l) => l.country ?? "Other places").map(([country, inCountry]) => ({
    country,
    count: inCountry.length,
    cities: groupBy(inCountry, (l) => l.city ?? "Elsewhere").map(([city, ls]) => ({ city, places: ls.map(place) })),
  }));
  return { work, places: sorted.map(place), countries, mainCity: countries[0].cities[0].city };
}

export type FilmedHere = { workId: string; title: string; type: Work["type"]; year: number | null; sceneNote: string | null; depicts: string | null; sourceUrl: string | null; sourceName: string | null };
export type LocationPage = {
  place: NearbyPlace; // for check-in, directions and the photo
  address: string | null; region: string | null; country: string | null;
  access: PublicAccess; confidence: LocationConfidence | null;
  checkIn: boolean;
  titles: FilmedHere[];
};

/** A published place with every title filmed there. Null if it isn't published. */
export function locationPage(id: number, works: Work[], locations: LiveLocation[]): LocationPage | null {
  const rows = locations.filter((l) => l.id === id && l.lat != null && l.lng != null);
  const byId = new Map(works.map((w) => [w.id, w]));
  const titles: FilmedHere[] = rows.flatMap((l) => {
    const w = byId.get(l.work_id);
    return w ? [{ workId: w.id, title: w.title, type: w.type, year: w.year, sceneNote: l.scene_note ?? null, depicts: l.depicts ?? null, sourceUrl: l.source_url ?? null, sourceName: l.source_name ?? null }] : [];
  }).sort((a, b) => a.title.localeCompare(b.title));
  if (!titles.length) return null;
  const first = rows.find((l) => byId.has(l.work_id))!;
  const place = buildNearby([first], works, { lat: first.lat!, lng: first.lng! }).places[0];
  return {
    place,
    address: first.address ?? null,
    region: first.region ?? null,
    country: first.country ?? null,
    access: first.public_access ?? "unknown",
    confidence: first.location_confidence ?? null,
    checkIn: canCheckIn({ lat: first.lat, lng: first.lng, coord_quality: first.coord_quality }),
    titles,
  };
}

export const ACCESS_TEXT: Record<PublicAccess, string> = {
  public: "Open to the public.",
  exterior_only: "View from outside only. Please don't go in.",
  restricted: "Restricted access. Visit only where you're allowed to be.",
  unknown: "Access not confirmed. Stay on public ground and respect residents.",
};

export const CONFIDENCE_TEXT: Record<LocationConfidence, string> = {
  exact: "The exact filming spot",
  building: "Filmed at this building",
  street: "Filmed on this street",
  area: "Filmed somewhere in this area",
};
