// Turns seed CSV records into table rows and checks them.
import type { Collection, CoordQuality, FilmLocation, Work } from "../lib/types";

type Rec = Record<string, string>;

const splitPipes = (s: string | undefined) =>
  (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);

const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

const QUALITIES: CoordQuality[] = ["source", "approx", "geocoded", "verified"];

export function toWork(r: Rec): Work {
  const type = r.type?.trim();
  if (type !== "series" && type !== "film") throw new Error(`Bad type "${type}" for ${r.title_id}`);
  return {
    id: r.title_id.trim(),
    title: r.title.trim(),
    type,
    aliases: splitPipes(r.aliases),
    year: r.year ? Number(r.year) : null,
  };
}

export function toLocation(r: Rec): FilmLocation {
  const lat = orNull(r.lat);
  const lng = orNull(r.lng);
  const hasCoords = lat !== null && lng !== null;
  const q = r.coord_quality?.trim() as CoordQuality;
  return {
    id: Number(r.id),
    work_id: r.title_id.trim(),
    name: r.location_name.trim(),
    scene_note: orNull(r.scene_note),
    address: orNull(r.address_or_area),
    city: orNull(r.city),
    region: orNull(r.region),
    lat: hasCoords ? Number(lat) : null,
    lng: hasCoords ? Number(lng) : null,
    // The CSV says "geocode" for rows still waiting for coordinates.
    coord_quality: hasCoords ? (QUALITIES.includes(q) ? q : "approx") : null,
    visit_note: orNull(r.visit_note),
    source_name: orNull(r.source_name),
    source_url: (r.source_url ?? "").trim(),
    status: r.status?.trim() === "unverified" ? "unverified" : "live",
  };
}

export function toCollection(r: Rec): Collection {
  return {
    id: r.id.trim(),
    name: r.name.trim(),
    city: orNull(r.city),
    work_ids: splitPipes(r.work_ids),
    description: orNull(r.description),
  };
}

/** Returns a list of problems; empty means the seed is safe to import. */
export function validateSeed(works: Work[], locations: FilmLocation[], collections: Collection[]): string[] {
  const problems: string[] = [];
  const workIds = new Set(works.map((w) => w.id));
  const seenLoc = new Set<number>();

  if (workIds.size !== works.length) problems.push("Duplicate work ids");
  for (const l of locations) {
    const where = `location ${l.id} (${l.name})`;
    if (!Number.isInteger(l.id) || l.id <= 0) problems.push(`${where}: bad id`);
    if (seenLoc.has(l.id)) problems.push(`${where}: duplicate id`);
    seenLoc.add(l.id);
    if (!workIds.has(l.work_id)) problems.push(`${where}: unknown work ${l.work_id}`);
    if (!/^https?:\/\//.test(l.source_url)) problems.push(`${where}: missing source_url`);
    if (l.lat !== null && (Number.isNaN(l.lat) || Math.abs(l.lat) > 90)) problems.push(`${where}: bad lat`);
    if (l.lng !== null && (Number.isNaN(l.lng) || Math.abs(l.lng) > 180)) problems.push(`${where}: bad lng`);
  }
  for (const c of collections) {
    for (const id of c.work_ids) {
      if (!workIds.has(id)) problems.push(`collection ${c.id}: unknown work ${id}`);
    }
  }
  return problems;
}
