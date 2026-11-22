// Cover photos that don't repeat on one screen. Pure.
import type { Photo } from "./nearby";

/** The Commons file a photo comes from (its file page), so two thumbnail sizes count as one file. */
export const commonsFile = (p: Photo): string => decodeURIComponent(p.page.split("/").pop() ?? p.page).toLowerCase();

/**
 * One cover per card, in display order: each card takes its first candidate whose Commons file no
 * earlier card (or `avoid`) uses. A card whose candidates are all taken gets null (the initials card).
 */
export function distinctCovers(candidates: (Photo | null | undefined)[][], avoid: Photo[] = []): (Photo | null)[] {
  const used = new Set(avoid.map(commonsFile));
  return candidates.map((list) => {
    const pick = list.find((p): p is Photo => !!p && !used.has(commonsFile(p))) ?? null;
    if (pick) used.add(commonsFile(pick));
    return pick;
  });
}

/** "Series · 2017", "Film" — from the data only. */
export const typeYear = (type: "film" | "series", year: number | null | undefined): string =>
  `${type === "series" ? "Series" : "Film"}${year ? ` · ${year}` : ""}`;
