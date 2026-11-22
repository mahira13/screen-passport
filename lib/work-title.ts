// Titles that are not a name: empty, "Unknown", "Untitled", "TBD", "N/A", "?" and the like.
const PLACEHOLDER = /^(?:unknown|untitled|no title|title|tbd|tba|n\/?a|none|null|undefined|test|placeholder|[-?.–—_\s]*)$/i;

export const isPlaceholderTitle = (title: string | null | undefined): boolean => PLACEHOLDER.test((title ?? "").trim());

/**
 * The name to store for a work. A real film called like a placeholder (e.g. "Unknown", 2011) gets
 * its year, "Unknown (2011)"; without a year it has no usable name and gets null (rejected).
 */
export function storableTitle(title: string | null | undefined, year: number | null): string | null {
  const t = (title ?? "").trim();
  if (!isPlaceholderTitle(t)) return t;
  return t && year ? `${t} (${year})` : null;
}
