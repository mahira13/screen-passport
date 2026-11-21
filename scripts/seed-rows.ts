// Turns seed CSV records into table rows and checks them.
// CSV column names equal the table columns; only types are converted here.
import type { Collection, CoordQuality, FilmLocation, LocationStatus, Work } from "../lib/types";

type Rec = Record<string, string>;

const splitPipes = (s: string | undefined) =>
  (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);

const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const numOrNull = (s: string | undefined) => (orNull(s) === null ? null : Number(s));

export function toWork(r: Rec): Work {
  return {
    id: r.id,
    title: r.title,
    type: r.type as Work["type"],
    aliases: splitPipes(r.aliases),
    year: numOrNull(r.year),
  };
}

export function toLocation(r: Rec): FilmLocation {
  return {
    id: Number(r.id),
    work_id: r.work_id,
    name: r.name,
    scene_note: orNull(r.scene_note),
    address: orNull(r.address),
    city: orNull(r.city),
    region: orNull(r.region),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    coord_quality: orNull(r.coord_quality) as CoordQuality | null,
    visit_note: orNull(r.visit_note),
    source_name: orNull(r.source_name),
    source_url: r.source_url ?? "",
    status: (orNull(r.status) ?? "unverified") as LocationStatus,
    geocode_query: orNull(r.geocode_query),
  };
}

export function toCollection(r: Rec): Collection {
  return {
    id: r.id,
    name: r.name,
    city: orNull(r.city),
    work_ids: splitPipes(r.work_ids),
    description: orNull(r.description),
  };
}

type Reviewed = Pick<FilmLocation, "id" | "lat" | "lng" | "coord_quality" | "status">;

/**
 * On re-import, keep what humans or the geocoder already changed in the
 * database: status, and coordinates once they exist.
 */
export function keepReviewedFields(csv: FilmLocation, db: Reviewed | undefined): FilmLocation {
  if (!db) return csv;
  const coords = db.lat !== null ? { lat: db.lat, lng: db.lng, coord_quality: db.coord_quality } : {};
  return { ...csv, status: db.status, ...coords };
}

const TYPES = ["series", "film"];
const QUALITIES = ["source", "approx", "geocoded", "verified"];
const STATUSES = ["live", "unverified"];

/** Returns a list of problems; empty means the seed is safe to import. */
export function validateSeed(works: Work[], locations: FilmLocation[], collections: Collection[]): string[] {
  const problems: string[] = [];
  const workIds = new Set(works.map((w) => w.id));
  const seenLoc = new Set<number>();

  if (workIds.size !== works.length) problems.push("Duplicate work ids");
  for (const w of works) {
    if (!TYPES.includes(w.type)) problems.push(`work ${w.id}: bad type "${w.type}"`);
  }
  for (const l of locations) {
    const where = `location ${l.id} (${l.name})`;
    if (!Number.isInteger(l.id) || l.id <= 0) problems.push(`${where}: bad id`);
    if (seenLoc.has(l.id)) problems.push(`${where}: duplicate id`);
    seenLoc.add(l.id);
    if (!workIds.has(l.work_id)) problems.push(`${where}: unknown work ${l.work_id}`);
    if (!/^https?:\/\//.test(l.source_url)) problems.push(`${where}: missing source_url`);
    if (!STATUSES.includes(l.status)) problems.push(`${where}: bad status "${l.status}"`);
    if (l.coord_quality !== null && !QUALITIES.includes(l.coord_quality))
      problems.push(`${where}: bad coord_quality "${l.coord_quality}"`);
    if ((l.lat === null) !== (l.lng === null)) problems.push(`${where}: lat and lng must both be set or both empty`);
    if (l.lat === null && l.coord_quality !== null) problems.push(`${where}: coord_quality without coordinates`);
    if (l.lat !== null && l.coord_quality === null) problems.push(`${where}: coordinates without coord_quality`);
    if (l.lat !== null && (Number.isNaN(l.lat) || Math.abs(l.lat) > 90)) problems.push(`${where}: bad lat`);
    if (l.lng !== null && (Number.isNaN(l.lng) || Math.abs(l.lng) > 180)) problems.push(`${where}: bad lng`);
    if (l.lat === null && !l.geocode_query) problems.push(`${where}: no coordinates and no geocode_query`);
  }
  for (const c of collections) {
    for (const id of c.work_ids) {
      if (!workIds.has(id)) problems.push(`collection ${c.id}: unknown work ${id}`);
    }
  }
  return problems;
}
