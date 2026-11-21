import type { Collection } from "./types";

export interface CollectionProgress {
  id: string;
  name: string;
  done: number;
  total: number;
  complete: boolean;
  /** "Cold War Berlin 2/4" */
  label: string;
}

export function collectionProgress(c: Collection, watched: string[]): CollectionProgress {
  const ids = [...new Set(c.work_ids)];
  const seen = new Set(watched);
  const done = ids.filter((id) => seen.has(id)).length;
  const total = ids.length;
  return {
    id: c.id,
    name: c.name,
    done,
    total,
    complete: total > 0 && done === total,
    label: `${c.name} ${done}/${total}`,
  };
}

/** Collections the user has started, most progress (by share) first. */
export function startedCollections(cs: Collection[], watched: string[]): CollectionProgress[] {
  return cs
    .map((c) => collectionProgress(c, watched))
    .filter((p) => p.done > 0)
    .sort((a, b) => b.done / b.total - a.done / a.total || b.done - a.done);
}
