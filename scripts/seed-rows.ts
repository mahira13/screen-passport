// Turns seed CSV records into table rows and checks them.
// CSV column names equal the table columns; only types are converted here.
// Format v2 (see data/seed/README.md): optional catalogue columns on locations.csv and a
// location_works.csv for extra titles at a place. v1 files (without them) still import.
import { isPlaceholderTitle } from "../lib/work-title";
import { isUntrustedSource } from "../lib/sources";
import type {
  Collection, CoordQuality, FilmLocation, LocationConfidence, LocationStatus, LocationWork, PublicAccess,
  VerificationStatus, Work,
} from "../lib/types";

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
    // v2, optional: empty means "keep what the database has" (or the default for new rows).
    country: orNull(r.country),
    country_code: orNull(r.country_code)?.toUpperCase() ?? null,
    location_confidence: orNull(r.location_confidence) as LocationConfidence | null,
    public_access: (orNull(r.public_access) ?? undefined) as PublicAccess | undefined,
    is_filming_location: orNull(r.is_filming_location) === null ? undefined : /^(true|yes|1)$/i.test(r.is_filming_location),
    merged_into: numOrNull(r.merged_into),
    aliases: splitPipes(r.aliases),
  };
}

export function toLocationWork(r: Rec): LocationWork & { evidence_name: string | null } {
  return {
    location_id: Number(r.location_id),
    work_id: r.work_id,
    scene_note: orNull(r.scene_note),
    depicts: orNull(r.depicts),
    evidence_url: orNull(r.evidence_url),
    evidence_name: orNull(r.evidence_name),
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

/** What the database already has for a location, read before the import. */
export type DbLocation = Reviewed & {
  verification_status: VerificationStatus; merged_into: number | null;
  country: string | null; country_code: string | null; location_confidence: LocationConfidence | null;
  public_access: PublicAccess; is_filming_location: boolean; aliases?: string[] | null;
};

/**
 * The row to upsert for one CSV location, or null to leave it alone (merged away in the database).
 * Never publishes: new rows arrive as draft, existing rows keep their verification status, and
 * coordinates checked in the database win over the CSV. Every row has the same keys, so one
 * upsert can't null a column that a CSV left empty.
 */
export function planLocationRow(csv: FilmLocation, db: DbLocation | undefined) {
  if (db?.merged_into) return null;
  const { lat, lng, coord_quality } = keepReviewedFields(csv, db);
  const text = {
    id: csv.id, work_id: csv.work_id, name: csv.name, scene_note: csv.scene_note, address: csv.address,
    city: csv.city, region: csv.region, lat, lng, coord_quality, visit_note: csv.visit_note,
    source_name: csv.source_name, source_url: csv.source_url, geocode_query: csv.geocode_query,
    // Aliases from the CSV and the database (e.g. from Wikidata labels), each once.
    aliases: [...new Set([...(csv.aliases ?? []), ...(db?.aliases ?? [])])],
  };
  if (db) {
    return {
      ...text,
      status: db.status, verification_status: db.verification_status, merged_into: db.merged_into,
      country: csv.country ?? db.country, country_code: csv.country_code ?? db.country_code,
      location_confidence: csv.location_confidence ?? db.location_confidence,
      public_access: csv.public_access ?? db.public_access,
      is_filming_location: csv.is_filming_location ?? db.is_filming_location,
    };
  }
  return {
    ...text,
    status: "unverified" as const,
    verification_status: (csv.merged_into ? "rejected" : "draft") as VerificationStatus,
    merged_into: csv.merged_into ?? null,
    // The geocoder and the pipeline only cover Germany so far.
    country: csv.country ?? "Germany", country_code: csv.country_code ?? "DE",
    location_confidence: csv.location_confidence ?? null,
    public_access: csv.public_access ?? "unknown",
    is_filming_location: csv.is_filming_location ?? true,
  };
}

/** Year from the CSV if given, else the database's (e.g. from TMDB); aliases from both. */
export function mergeWork(csv: Work, db: Pick<Work, "year" | "aliases"> | undefined): Work {
  if (!db) return csv;
  const seen = new Set<string>();
  const aliases = [...csv.aliases, ...(db.aliases ?? [])].filter((a) => {
    const k = a.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  return { ...csv, year: csv.year ?? db.year, aliases };
}

const TYPES = ["series", "film"];
const QUALITIES = ["source", "approx", "geocoded", "geocoded_poi", "verified"];
const CONFIDENCES = ["exact", "building", "street", "area"];
const ACCESS = ["public", "exterior_only", "restricted", "unknown"];

/** Returns a list of problems; empty means the seed is safe to import. */
export function validateSeed(
  works: Work[], locations: FilmLocation[], collections: Collection[],
  links: (LocationWork & { evidence_name?: string | null })[] = [],
): string[] {
  const problems: string[] = [];
  const workIds = new Set(works.map((w) => w.id));
  const seenLoc = new Set<number>();

  if (workIds.size !== works.length) problems.push("Duplicate work ids");
  for (const w of works) {
    if (!TYPES.includes(w.type)) problems.push(`work ${w.id}: bad type "${w.type}"`);
    if (isPlaceholderTitle(w.title)) problems.push(`work ${w.id}: "${w.title}" is not a title (add the year, e.g. "Unknown (2011)")`);
  }
  for (const l of locations) {
    const where = `location ${l.id} (${l.name})`;
    if (!Number.isInteger(l.id) || l.id <= 0) problems.push(`${where}: bad id`);
    if (seenLoc.has(l.id)) problems.push(`${where}: duplicate id`);
    seenLoc.add(l.id);
    if (!workIds.has(l.work_id)) problems.push(`${where}: unknown work ${l.work_id}`);
    if (!/^https?:\/\//.test(l.source_url)) problems.push(`${where}: missing source_url`);
    if (l.status === "live") problems.push(`${where}: seed rows can't be live; publish in /admin/locations or with npm run verify`);
    else if (l.status !== "unverified") problems.push(`${where}: bad status "${l.status}"`);
    if (l.location_confidence && !CONFIDENCES.includes(l.location_confidence))
      problems.push(`${where}: bad location_confidence "${l.location_confidence}"`);
    if (l.public_access && !ACCESS.includes(l.public_access)) problems.push(`${where}: bad public_access "${l.public_access}"`);
    if (l.country_code && !/^[A-Z]{2}$/.test(l.country_code)) problems.push(`${where}: bad country_code "${l.country_code}"`);
    if (isUntrustedSource(l.source_url) && /^https?:\/\//.test(l.source_url)) problems.push(`${where}: untrusted source ${l.source_url}`);
    if (l.coord_quality !== null && !QUALITIES.includes(l.coord_quality))
      problems.push(`${where}: bad coord_quality "${l.coord_quality}"`);
    if ((l.lat === null) !== (l.lng === null)) problems.push(`${where}: lat and lng must both be set or both empty`);
    if (l.lat === null && l.coord_quality !== null) problems.push(`${where}: coord_quality without coordinates`);
    if (l.lat !== null && l.coord_quality === null) problems.push(`${where}: coordinates without coord_quality`);
    if (l.lat !== null && (Number.isNaN(l.lat) || Math.abs(l.lat) > 90)) problems.push(`${where}: bad lat`);
    if (l.lng !== null && (Number.isNaN(l.lng) || Math.abs(l.lng) > 180)) problems.push(`${where}: bad lng`);
    if (l.lat === null && !l.geocode_query) problems.push(`${where}: no coordinates and no geocode_query`);
  }
  const locIds = new Set(locations.map((l) => l.id));
  for (const l of locations) {
    if (l.merged_into != null && (l.merged_into === l.id || !locIds.has(l.merged_into)))
      problems.push(`location ${l.id}: merged_into ${l.merged_into} is not another location`);
  }
  const seenLink = new Set<string>();
  for (const k of links) {
    const where = `location_works ${k.location_id}/${k.work_id}`;
    if (!locIds.has(k.location_id)) problems.push(`${where}: unknown location`);
    if (!workIds.has(k.work_id)) problems.push(`${where}: unknown work`);
    if (seenLink.has(where)) problems.push(`${where}: duplicate`);
    seenLink.add(where);
    if (!k.evidence_url || !/^https?:\/\//.test(k.evidence_url)) problems.push(`${where}: missing evidence_url`);
    else if (isUntrustedSource(k.evidence_url)) problems.push(`${where}: untrusted source ${k.evidence_url}`);
  }
  for (const c of collections) {
    for (const id of c.work_ids) {
      if (!workIds.has(id)) problems.push(`collection ${c.id}: unknown work ${id}`);
    }
  }
  return problems;
}
