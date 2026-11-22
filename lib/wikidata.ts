// Wikidata filming locations (P915) as draft candidates. Product rule 3: Wikidata finds
// candidates but is never the evidence for a published place, so every candidate is inserted
// as draft and must pass the AI verification pipeline (or a teammate) with a trusted source.
import { REGION } from "./region";
import { haversineKm } from "./distance";
import { isUntrustedSource } from "./sources";
import { namesMatch } from "./verify/geo";

const NEAR_KM = 0.1;
export const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

const BUILDING = ["wd:Q41176", "wd:Q811979"]; // building, architectural structure
const BROAD = ["wd:Q486972", "wd:Q56061"]; // human settlement, administrative area: too broad to visit
const OPEN = ["wd:Q34442", "wd:Q79007", "wd:Q174782"]; // road, street, square: an area, not a building
const STUDIO = /\b(film)?studios?\b|filmstudio|studio babelsberg/i; // product rule 7: no closed studio sets
const HOME = ["wd:Q3947", "wd:Q11755880"]; // house, residential building (product rule 7)
const CITY = ["wd:Q515", "wd:Q262166"]; // city, municipality of Germany

const isA = (classes: string[], direct = false) =>
  classes.map((c) => `EXISTS { ?loc wdt:P31${direct ? "" : "/wdt:P279*"} ${c} }`).join(" || ");

/** Filming locations of one work, in the launch region (REGION), one row per place. */
export function filmingLocationsQuery(workQid: string): string {
  if (!/^Q\d+$/.test(workQid)) throw new Error(`Not a Wikidata item id: ${workQid}`);
  return `SELECT ?loc (SAMPLE(?name) AS ?label) (SAMPLE(?coord) AS ?point) (SAMPLE(STR(?cityName)) AS ?city)
  (GROUP_CONCAT(DISTINCT STR(?ref); separator=" ") AS ?refs)
  (SAMPLE(?b) AS ?building) (SAMPLE(?o) AS ?open) (SAMPLE(?w) AS ?broad) (SAMPLE(?h) AS ?home) WHERE {
  wd:${workQid} p:P915 ?st . ?st ps:P915 ?loc .
  ?loc wdt:P17 wd:${REGION.wikidataQid} .
  OPTIONAL { ?st prov:wasDerivedFrom/pr:P854 ?ref }
  OPTIONAL { ?loc wdt:P625 ?coord }
  OPTIONAL { ?loc wdt:P131* ?c . VALUES ?cityClass { ${CITY.join(" ")} } ?c wdt:P31/wdt:P279* ?cityClass .
             ?c rdfs:label ?cityName . FILTER(LANG(?cityName) IN ("de", "mul")) }
  OPTIONAL { ?loc rdfs:label ?de . FILTER(LANG(?de) = "de") }
  OPTIONAL { ?loc rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?loc rdfs:label ?mul . FILTER(LANG(?mul) = "mul") } # names shared by all languages
  BIND(STR(COALESCE(?de, ?mul, ?en)) AS ?name)
  BIND(${isA(BUILDING)} AS ?b)
  BIND(${isA(OPEN)} AS ?o)
  BIND(${isA(BROAD)} AS ?w)
  BIND(${isA(HOME, true)} AS ?h)
} GROUP BY ?loc`;
}

type Cell = { value: string } | undefined;
export type SparqlRow = Record<string, Cell>;

export interface Candidate {
  qid: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  confidence: "building" | "area";
  refs: string[]; // reference URLs on the statement, if any
  skip: string | null; // why it isn't inserted at all
}

const point = (wkt: string | undefined) => {
  const m = wkt?.match(/Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : { lat: null, lng: null };
};

export function toCandidate(row: SparqlRow): Candidate {
  const qid = row.loc?.value.split("/").pop() ?? "";
  const truthy = (c: Cell) => c?.value === "true" || c?.value === "1";
  const name = row.label?.value ?? qid;
  const building = truthy(row.building) && !truthy(row.open);
  const skip = truthy(row.home) ? "possible private home"
    : STUDIO.test(name) ? "a film studio (closed sets aren't listed)"
    : truthy(row.broad) && !building ? "a whole town or district, not a place to visit"
    : name === qid ? "no German or English name" : null;
  return {
    qid, name, city: row.city?.value ?? null, ...point(row.point?.value),
    confidence: building ? "building" : "area",
    refs: (row.refs?.value ?? "").split(" ").filter((u) => /^https?:\/\//.test(u)),
    skip,
  };
}

export type Existing = { id: number; name: string; city: string | null; lat: number | null; lng: number | null };

/**
 * A place we may already have: same name in the same city, or within 100 m (Wikidata often uses the
 * German name, e.g. "Glienicker Brücke" for our "Glienicke Bridge"). Reported, never inserted twice.
 */
export function findExisting(c: Candidate, existing: Existing[]): { place: Existing; metres: number | null } | null {
  for (const e of existing) {
    const km = c.lat !== null && c.lng !== null && e.lat !== null && e.lng !== null
      ? haversineKm({ lat: c.lat, lng: c.lng }, { lat: e.lat, lng: e.lng }) : null;
    const sameCity = !c.city || !e.city || c.city.toLowerCase() === e.city.toLowerCase();
    if ((km !== null && km <= NEAR_KM) || (sameCity && namesMatch(c.name, e.name, c.city)))
      return { place: e, metres: km === null ? null : Math.round(km * 1000) };
  }
  return null;
}

/** The draft row for a candidate. The source is a cited reference if one is usable, else the item. */
export function draftRow(c: Candidate, workId: string) {
  const ref = c.refs.find((u) => !isUntrustedSource(u));
  return {
    work_id: workId,
    name: c.name,
    city: c.city,
    lat: c.lat,
    lng: c.lng,
    coord_quality: c.lat !== null ? ("approx" as const) : null, // Wikidata points are unchecked
    geocode_query: [c.name, c.city, REGION.country].filter(Boolean).join(", "),
    scene_note: null, // Wikidata has no scenes, and Claude never invents one
    source_url: ref ?? `https://www.wikidata.org/wiki/${c.qid}`,
    source_name: ref ? new URL(ref).hostname.replace(/^www\./, "") : "Wikidata (candidate only)",
    status: "unverified" as const,
    verification_status: "draft" as const,
    location_confidence: c.confidence,
    public_access: "unknown" as const,
    is_filming_location: true,
    country: REGION.country,
    country_code: REGION.countryCode,
  };
}

export type WorkItem = { qid: string; labels: string[]; film: boolean; series: boolean; year: number | null };

/** Films and TV series among search hits, with their labels and first year. */
export function workTypesQuery(qids: string[]): string {
  const ids = qids.filter((q) => /^Q\d+$/.test(q)).map((q) => `wd:${q}`).join(" ");
  return `SELECT ?item (GROUP_CONCAT(DISTINCT STR(?l); separator="|") AS ?labels)
  (SAMPLE(?f) AS ?film) (SAMPLE(?s) AS ?series) (MIN(YEAR(?d)) AS ?year) WHERE {
  VALUES ?item { ${ids} }
  OPTIONAL { ?item rdfs:label ?l . FILTER(LANG(?l) IN ("en", "de", "mul")) }
  OPTIONAL { ?item wdt:P577|wdt:P580 ?d }
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q11424 } AS ?f)
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q5398426 } AS ?s)
} GROUP BY ?item`;
}

export function toWorkItem(row: SparqlRow): WorkItem {
  const yes = (c: Cell) => c?.value === "true" || c?.value === "1";
  return {
    qid: row.item?.value.split("/").pop() ?? "",
    labels: (row.labels?.value ?? "").split("|").filter(Boolean),
    film: yes(row.film), series: yes(row.series),
    year: row.year?.value ? Number(row.year.value) : null,
  };
}

/**
 * The Wikidata item for one of our works: right type, a label equal to the title or an alias,
 * and the year if we know it. Several left → ambiguous; pass --qid work=Q… instead of guessing.
 */
export function pickWorkItem(
  work: { title: string; aliases: string[]; type: "film" | "series"; year: number | null },
  items: WorkItem[], normalise: (s: string) => string,
): { qid: string } | { ambiguous: WorkItem[] } {
  const names = new Set([work.title, ...work.aliases].map(normalise));
  const fits = items.filter((i) => (work.type === "film" ? i.film : i.series)
    && i.labels.some((l) => names.has(normalise(l)))
    && (work.year === null || i.year === work.year));
  return fits.length === 1 ? { qid: fits[0].qid } : { ambiguous: fits };
}
