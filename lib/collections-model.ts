// Every collection a visitor can play: curated rows from the collections table, plus automatic ones
// built from published places (a title with 3+ places, a city with 5+). Pure; built from live data.
import { canCheckIn } from "./distance";
import { coverPhoto, photoOf, type LiveLocation, type Photo } from "./nearby";
import type { Collection, Work } from "./types";

export type CollectionKind = "curated" | "title" | "city";

export type CollectionPlace = {
  id: number; name: string; city: string | null; lat: number; lng: number;
  checkIn: boolean; // check-in grade pin
  photo: boolean; // has an approved or auto Commons photo
  thumb: string | null; // that photo's thumbnail, for the map marker
  titles: string[];
};

export type CollectionModel = {
  key: string; // "curated:<id>", "title:<work id>", "city:<slug>"
  kind: CollectionKind;
  slug: string;
  name: string;
  description: string | null;
  href: string;
  city: string | null;
  works: { id: string; title: string }[];
  places: CollectionPlace[]; // each physical place once, by id
  cover: Photo | null;
  pinRank: number | null; // featured_rank from the table (curated only)
};

export const TITLE_MIN_PLACES = 3;
export const CITY_MIN_PLACES = 5;

/** "Görlitz" → "goerlitz", "Berlin/Potsdam" → "berlin-potsdam". */
export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type Data = { works: Work[]; locations: LiveLocation[]; collections: Collection[] };

function placesOf(rows: LiveLocation[], titleOf: Map<string, string>, all: LiveLocation[]): CollectionPlace[] {
  const ids = [...new Set(rows.filter((l) => l.lat != null && l.lng != null).map((l) => l.id))].sort((a, b) => a - b);
  return ids.map((id) => {
    const same = all.filter((l) => l.id === id);
    const l = same[0];
    return {
      id, name: l.name, city: l.city, lat: l.lat!, lng: l.lng!,
      checkIn: canCheckIn({ lat: l.lat, lng: l.lng, coord_quality: l.coord_quality }),
      photo: !!photoOf(l),
      thumb: photoOf(l)?.url ?? null,
      titles: [...new Set(same.flatMap((x) => titleOf.get(x.work_id) ?? []))],
    };
  });
}

const firstPhoto = (places: CollectionPlace[], rows: LiveLocation[]) => {
  const p = places.find((x) => x.photo);
  return p ? photoOf(rows.find((l) => l.id === p.id)!) : null;
};

export function buildCollections({ works, locations, collections }: Data): CollectionModel[] {
  const titleOf = new Map(works.map((w) => [w.id, w.title]));
  const out: CollectionModel[] = [];

  for (const c of collections) {
    const ws = [...new Set(c.work_ids)].flatMap((id) => (titleOf.has(id) ? [{ id, title: titleOf.get(id)! }] : []));
    out.push({
      key: `curated:${c.id}`, kind: "curated", slug: c.id, name: c.name, description: c.description,
      href: `/collection/${encodeURIComponent(c.id)}`, city: c.city, works: ws,
      places: placesOf(locations.filter((l) => c.work_ids.includes(l.work_id)), titleOf, locations),
      cover: coverPhoto(c.work_ids, locations), pinRank: c.featured_rank ?? null,
    });
  }

  for (const w of works) {
    const rows = locations.filter((l) => l.work_id === w.id);
    const places = placesOf(rows, titleOf, locations);
    if (places.length < TITLE_MIN_PLACES) continue;
    out.push({
      key: `title:${w.id}`, kind: "title", slug: w.id, name: `${w.title} locations`,
      description: `Every published filming place of ${w.title}.`, href: `/collection/title/${encodeURIComponent(w.id)}`,
      city: null, works: [{ id: w.id, title: w.title }], places, cover: firstPhoto(places, rows), pinRank: null,
    });
  }

  const cities = [...new Set(locations.map((l) => l.city).filter((c): c is string => !!c))];
  for (const city of cities) {
    const rows = locations.filter((l) => l.city === city);
    const places = placesOf(rows, titleOf, locations);
    if (places.length < CITY_MIN_PLACES) continue;
    const slug = slugify(city);
    out.push({
      key: `city:${slug}`, kind: "city", slug, name: `Filmed in ${city}`,
      description: `Every published filming place in ${city}.`, href: `/collection/city/${slug}`, city,
      works: [...new Set(rows.map((l) => l.work_id))].flatMap((id) => (titleOf.has(id) ? [{ id, title: titleOf.get(id)! }] : [])),
      places, cover: firstPhoto(places, rows), pinRank: null,
    });
  }
  return out;
}

export const findCollection = (all: CollectionModel[], kind: CollectionKind, slug: string) =>
  all.find((c) => c.kind === kind && c.slug === slug) ?? null;
