// Network calls to Wikidata and TMDB, shared by the scripts and the pipeline jobs. Server only.
import { normaliseTitle } from "../match";
import { type Details, metadataUpdate, pickHit, type SearchHit } from "../tmdb";
import type { Work } from "../types";
import { SPARQL_ENDPOINT, type SparqlRow } from "../wikidata";

// Wikimedia asks for a descriptive User-Agent. No personal contact unless one is set.
const contact = () => process.env.WIKIDATA_CONTACT || process.env.GEOCODER_CONTACT;
const UA = () => `ScreenPassport-pipeline/0.2${contact() ? ` (${contact()})` : ""}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sparql(query: string, retries = 2): Promise<SparqlRow[]> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: { "User-Agent": UA(), Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(60_000),
  });
  if ((res.status >= 500 || res.status === 429) && retries > 0) {
    await pause(5000);
    return sparql(query, retries - 1);
  }
  if (!res.ok) throw new Error(`Wikidata query service ${res.status}`);
  return ((await res.json()) as { results: { bindings: SparqlRow[] } }).results.bindings;
}

/** Wikidata item ids whose label or alias matches text, in English and German. */
export async function searchItems(text: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const language of ["en", "de"]) {
    const params = new URLSearchParams({ action: "wbsearchentities", search: text, language, type: "item", limit: "10", format: "json" });
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params}`, { headers: { "User-Agent": UA() }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Wikidata search ${res.status}`);
    for (const s of ((await res.json()) as { search: { id: string }[] }).search) ids.add(s.id);
  }
  return [...ids];
}

const TMDB_API = "https://api.themoviedb.org/3";

export const tmdbConfigured = () => !!(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);

export async function tmdb<T>(path: string, params: Record<string, string> = {}, retries = 2): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) throw new Error("Set TMDB_READ_TOKEN or TMDB_API_KEY (free at themoviedb.org/settings/api).");
  const q = new URLSearchParams({ ...params, ...(token ? {} : { api_key: key! }) });
  const res = await fetch(`${TMDB_API}${path}?${q}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429 && retries > 0) {
    await pause(2000);
    return tmdb(path, params, retries - 1);
  }
  if (!res.ok) throw new Error(`TMDB ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Year and DE/EN alternative titles from TMDB for one work, or null when the match isn't unique. */
export async function tmdbMetadata(work: Work): Promise<{ year: number | null; aliases: string[]; added: string[] } | null> {
  const kind = work.type === "film" ? "movie" : "tv";
  const yearParam = work.year ? { [kind === "movie" ? "year" : "first_air_date_year"]: String(work.year) } : {};
  const hits = (await tmdb<{ results: SearchHit[] }>(`/search/${kind}`, { query: work.title, include_adult: "false", ...yearParam })).results;
  const picked = pickHit(work, hits, normaliseTitle);
  if (!("hit" in picked)) return null;
  const d = await tmdb<Details>(`/${kind}/${picked.hit.id}`, { append_to_response: "alternative_titles,translations" });
  return metadataUpdate(work, d);
}
