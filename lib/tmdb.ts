// TMDB metadata for works: release year and German/English alternative titles, nothing else.
// No filming locations come from TMDB. Terms: credit TMDB (see TMDB_ATTRIBUTION, shown in the
// footer), key from env, and the app doesn't claim TMDB endorses it.
import type { Work } from "./types";

export const TMDB_ATTRIBUTION = "Title metadata from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.";

export type SearchHit = { id: number; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string };
export type AltTitle = { iso_3166_1: string; title: string; type?: string };
export type Translation = { iso_3166_1: string; iso_639_1: string; data: { title?: string; name?: string } };
export type Details = SearchHit & {
  alternative_titles?: { titles?: AltTitle[]; results?: AltTitle[] };
  translations?: { translations: Translation[] };
};

const COUNTRIES = new Set(["DE", "AT", "CH", "US", "GB"]);
const LANGUAGES = new Set(["de", "en"]);
const MAX_NEW_ALIASES = 8;

const yearOf = (d: string | undefined) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
const namesOf = (h: SearchHit) => [h.title, h.name, h.original_title, h.original_name].filter((x): x is string => !!x);

/**
 * The TMDB entry for a work: a hit whose title (or original title) equals our title or an alias,
 * in our year if we know it. Several left → ambiguous; pass --id work=movie:123 instead of guessing.
 */
export function pickHit(work: Pick<Work, "title" | "aliases" | "year">, hits: SearchHit[], normalise: (s: string) => string):
  { hit: SearchHit } | { ambiguous: SearchHit[] } {
  const names = new Set([work.title, ...work.aliases].map(normalise));
  const fits = hits.filter((h) => namesOf(h).some((n) => names.has(normalise(n)))
    && (work.year === null || yearOf(h.release_date ?? h.first_air_date) === work.year));
  return fits.length === 1 ? { hit: fits[0] } : { ambiguous: fits };
}

/** Year (only if we have none, unless forced) and aliases added to what we have; never removes any. */
export function metadataUpdate(work: Pick<Work, "title" | "aliases" | "year">, d: Details, force = false) {
  const year = yearOf(d.release_date ?? d.first_air_date);
  const alts = [...(d.alternative_titles?.titles ?? []), ...(d.alternative_titles?.results ?? [])]
    .filter((a) => COUNTRIES.has(a.iso_3166_1) && !/working|informal|promotional/i.test(a.type ?? ""))
    .map((a) => a.title);
  const translated = (d.translations?.translations ?? [])
    .filter((t) => LANGUAGES.has(t.iso_639_1))
    .map((t) => t.data.title ?? t.data.name ?? "");
  const seen = new Set([work.title, ...work.aliases].map((s) => s.toLowerCase()));
  const added: string[] = [];
  for (const raw of [...translated, ...alts]) {
    const a = raw.trim();
    if (!a || a.length > 120 || seen.has(a.toLowerCase()) || added.length >= MAX_NEW_ALIASES) continue;
    seen.add(a.toLowerCase());
    added.push(a);
  }
  return {
    year: work.year === null || force ? year ?? work.year : work.year,
    aliases: [...work.aliases, ...added],
    added,
  };
}
