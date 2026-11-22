// Pure decisions for the pipeline: which Wikidata item a requested title means, a new work's id,
// and what a title request shows while it runs.
import { slugify } from "../collections-model";
import { normaliseTitle } from "../match";
import type { WorkItem } from "../wikidata";

/** "Dark 2017" or "Dark (2017)" -> { title: "Dark", year: 2017 }. */
export function splitYear(text: string): { title: string; year: number | null } {
  const m = text.trim().match(/^(.*?)[\s(]+((?:19|20)\d{2})\)?$/);
  return m && m[1].trim() ? { title: m[1].trim(), year: Number(m[2]) } : { title: text.trim(), year: null };
}

/**
 * The film or series a visitor asked for: a label equal to the text (and the year, if given).
 * Several fit → ambiguous (we ask for the year instead of guessing); none → not found.
 */
export function pickRequested(text: string, items: WorkItem[]): { item: WorkItem } | { ambiguous: WorkItem[] } | { none: true } {
  const { title, year } = splitYear(text);
  const want = normaliseTitle(title);
  const fits = items.filter((i) => (i.film || i.series) && i.labels.some((l) => normaliseTitle(l) === want) && (year === null || i.year === year));
  if (fits.length === 1) return { item: fits[0] };
  return fits.length ? { ambiguous: fits } : { none: true };
}

/** A readable, unique id for a new work: "dark", else "dark-2017", else "dark-q123". */
export function workIdFor(title: string, year: number | null, qid: string, taken: Set<string>): string {
  const base = slugify(title).slice(0, 60) || qid.toLowerCase();
  for (const id of [base, year ? `${base}-${year}` : null, `${base}-${qid.toLowerCase()}`]) if (id && !taken.has(id)) return id;
  return `${base}-${qid.toLowerCase()}`;
}

export type SearchStatus = "queued" | "searching" | "found" | "nothing" | "failed";
export type SearchView = { status: SearchStatus; found: number; message: string | null; workId: string | null; done: boolean };

/** What a request shows: found/nothing/failed once its jobs are finished, searching while any run. */
export function searchView(
  req: { search_status: SearchStatus | null; found: number; message: string | null; work_id: string | null },
  openJobs: number, runningJobs: number,
): SearchView {
  const final = req.search_status === "found" || req.search_status === "nothing" || req.search_status === "failed";
  if (final && openJobs === 0) return { status: req.search_status!, found: req.found, message: req.message, workId: req.work_id, done: true };
  return { status: runningJobs > 0 || req.search_status === "searching" ? "searching" : "queued", found: req.found, message: null, workId: req.work_id, done: false };
}

/** Plain words for the search box. */
export function searchText(v: SearchView, title: string): string {
  switch (v.status) {
    case "queued": return `Queued: we'll look for filming locations of ${title}.`;
    case "searching": return `Searching sources for ${title}…${v.found ? ` ${v.found} verified so far.` : ""}`;
    case "found": return `Found ${v.found} verified ${v.found === 1 ? "place" : "places"} for ${title}.`;
    case "nothing": return v.message ?? `Nothing verified for ${title} yet. We keep the request and look again.`;
    case "failed": return `The search for ${title} stopped. We'll try again later.`;
  }
}
