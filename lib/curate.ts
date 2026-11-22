// Picking places for a hand-made collection from published data. Pure; scripts/curate-collections.ts
// loads the data and writes the result. Best first: check-in grade, then has a photo, then lowest id.

export type Candidate = { id: number; city: string | null; works: string[]; checkIn: boolean; photo: boolean };
export type PickRules = {
  max: number;
  perTitle: number; // a place counts against every title filmed there
  spreadCities?: boolean; // take one per city in turn (biggest city first) instead of best overall
};

const rank = (a: Candidate, b: Candidate) =>
  Number(b.checkIn) - Number(a.checkIn) || Number(b.photo) - Number(a.photo) || a.id - b.id;

export function pickPlaces(candidates: Candidate[], rules: PickRules): Candidate[] {
  const used = new Map<string, number>();
  const fits = (c: Candidate) => c.works.length > 0 && c.works.every((w) => (used.get(w) ?? 0) < rules.perTitle);
  const out: Candidate[] = [];
  const take = (c: Candidate) => {
    out.push(c);
    for (const w of c.works) used.set(w, (used.get(w) ?? 0) + 1);
  };
  const sorted = [...new Map(candidates.map((c) => [c.id, c])).values()].sort(rank);

  if (!rules.spreadCities) {
    for (const c of sorted) if (out.length < rules.max && fits(c)) take(c);
    return out;
  }
  const byCity = new Map<string, Candidate[]>();
  for (const c of sorted) byCity.set(c.city ?? "", [...(byCity.get(c.city ?? "") ?? []), c]);
  const cities = [...byCity.keys()].sort((a, b) => byCity.get(b)!.length - byCity.get(a)!.length || a.localeCompare(b));
  let added = true;
  while (out.length < rules.max && added) {
    added = false;
    for (const city of cities) {
      if (out.length >= rules.max) break;
      const next = byCity.get(city)!.find((c) => !out.includes(c) && fits(c));
      if (next) { take(next); added = true; }
    }
  }
  return out;
}

export const cityCount = (picked: Candidate[]) => new Set(picked.map((c) => c.city)).size;
