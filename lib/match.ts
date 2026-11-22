import type { Work } from "./types";

const LEADING_ARTICLES = /^(the|a|an|der|die|das|le|la|les|el)\s+/;

/**
 * Lowercase, no accents, no punctuation, single spaces, no leading article,
 * no trailing "(2011)". German umlauts fold to their base letter (ö -> o).
 */
export function normaliseTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\s*\d{4}\s*\)\s*$/, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

function namesOf(work: Work): string[] {
  return [work.title, ...work.aliases].map(normaliseTitle).filter(Boolean);
}

/**
 * Exact match on title or any alias after normalising.
 * Returns null when nothing matches or when two works share the name.
 */
export function matchTitle(raw: string, works: Work[]): Work | null {
  const q = normaliseTitle(raw);
  if (!q) return null;
  const hits = works.filter((w) => namesOf(w).includes(q));
  return hits.length === 1 ? hits[0] : null;
}
