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

/**
 * Autocomplete over our works only. Ranks: exact name, name starts with the
 * query, a word starts with the query, query appears anywhere.
 */
export function searchWorks(raw: string, works: Work[], limit = 8): Work[] {
  const q = normaliseTitle(raw);
  if (!q) return [];
  const rank = (w: Work): number => {
    let best = Infinity;
    for (const name of namesOf(w)) {
      if (name === q) best = Math.min(best, 0);
      else if (name.startsWith(q)) best = Math.min(best, 1);
      else if (name.split(" ").some((word) => word.startsWith(q)) || name.includes(` ${q}`))
        best = Math.min(best, 2);
      else if (name.includes(q)) best = Math.min(best, 3);
    }
    return best;
  };
  return works
    .map((w) => ({ w, r: rank(w) }))
    .filter((x) => x.r !== Infinity)
    .sort((a, b) => a.r - b.r || normaliseTitle(a.w.title).localeCompare(normaliseTitle(b.w.title)))
    .slice(0, limit)
    .map((x) => x.w);
}
