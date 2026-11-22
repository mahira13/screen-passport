import { haversineKm } from "./distance";

export interface DuplicateCandidate {
  id: number;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

export interface DuplicateGroup {
  ids: number[]; // lowest first: the suggested row to keep
  names: string[];
  reason: "same name and city" | "within 30 m" | "same name and city, within 30 m";
}

export const DUPLICATE_RADIUS_KM = 0.03;

// "Alexanderplatz (World Clock)" -> "alexanderplatz"; accents and case ignored.
const fold = (s: string | null) =>
  (s ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/ß/g, "ss").normalize("NFKD").replace(/[^a-z0-9]/g, "");

/**
 * Places that are probably the same physical spot: same name and city, or within 30 m.
 * Only suggestions; a human decides what to merge (scripts/find-duplicates.ts).
 */
export function duplicateGroups(locations: DuplicateCandidate[]): DuplicateGroup[] {
  const parent = new Map(locations.map((l) => [l.id, l.id]));
  const root = (id: number): number => (parent.get(id) === id ? id : root(parent.get(id)!));
  const reasons = new Map<number, Set<string>>();
  const join = (a: number, b: number, why: string) => {
    const [ra, rb] = [root(a), root(b)];
    const r = Math.min(ra, rb);
    parent.set(ra, r);
    parent.set(rb, r);
    reasons.set(a, (reasons.get(a) ?? new Set()).add(why));
  };

  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const [a, b] = [locations[i], locations[j]];
      if (fold(a.name) && fold(a.name) === fold(b.name) && fold(a.city) === fold(b.city)) join(a.id, b.id, "name");
      if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null &&
          haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= DUPLICATE_RADIUS_KM) join(a.id, b.id, "near");
    }
  }

  const groups = new Map<number, DuplicateCandidate[]>();
  for (const l of locations) groups.set(root(l.id), [...(groups.get(root(l.id)) ?? []), l]);
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const sorted = [...g].sort((a, b) => a.id - b.id);
      const why = new Set(sorted.flatMap((l) => [...(reasons.get(l.id) ?? [])]));
      const reason: DuplicateGroup["reason"] = why.has("name") && why.has("near")
        ? "same name and city, within 30 m" : why.has("name") ? "same name and city" : "within 30 m";
      return { ids: sorted.map((l) => l.id), names: sorted.map((l) => l.name), reason };
    })
    .sort((a, b) => a.ids[0] - b.ids[0]);
}

export type MergePlace = DuplicateCandidate & { aliases?: string[] | null };

/**
 * Automatic merges (the pipeline's rule, stricter than the suggestions above): within 30 m AND the
 * same named place (namesMatch on name or alias, ignoring the city's own words). Each group keeps
 * its lowest id. Passports and trips are remapped by merge_locations().
 */
export function autoMerges(places: MergePlace[], sameName: (a: string, b: string, city: string | null) => boolean): { keep: number; drop: number[] }[] {
  const names = (p: MergePlace) => [p.name, ...(p.aliases ?? [])];
  const near = places.filter((p) => p.lat !== null && p.lng !== null);
  const parent = new Map(near.map((p) => [p.id, p.id]));
  const root = (id: number): number => (parent.get(id) === id ? id : root(parent.get(id)!));
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const [a, b] = [near[i], near[j]];
      if (haversineKm({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! }) > DUPLICATE_RADIUS_KM) continue;
      if (!names(a).some((x) => names(b).some((y) => sameName(x, y, a.city ?? b.city)))) continue;
      const [ra, rb] = [root(a.id), root(b.id)];
      parent.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  const groups = new Map<number, number[]>();
  for (const p of near) groups.set(root(p.id), [...(groups.get(root(p.id)) ?? []), p.id]);
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([keep, ids]) => ({ keep, drop: ids.filter((id) => id !== keep).sort((x, y) => x - y) }))
    .sort((x, y) => x.keep - y.keep);
}

const DUPLICATE_REASON = /^published place within 30 m \(#([\d, #]+)\)$/;

/** Ids of the published places a verified draft duplicates, when that is the ONLY reason it wasn't published. */
export function onlyDuplicateOf(reasons: string[]): number[] | null {
  if (reasons.length !== 1) return null;
  const m = reasons[0].match(DUPLICATE_REASON);
  return m ? m[1].split(/[,\s#]+/).filter(Boolean).map(Number) : null;
}
