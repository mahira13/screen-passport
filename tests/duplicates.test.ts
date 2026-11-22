import { describe, expect, it } from "vitest";
import { duplicateGroups, type DuplicateCandidate } from "@/lib/duplicates";

const loc = (id: number, name: string, city: string | null, lat: number | null, lng: number | null): DuplicateCandidate => ({
  id, name, city, lat, lng,
});

describe("duplicateGroups", () => {
  it("groups the same name in the same city, ignoring case, accents and brackets", () => {
    const g = duplicateGroups([
      loc(22, "Kino International", "Berlin", null, null),
      loc(56, "kino international", "berlin", null, null),
      loc(7, "Kino International", "Hamburg", null, null),
    ]);
    expect(g.map((x) => x.ids)).toEqual([[22, 56]]);
    expect(g[0].reason).toBe("same name and city");
  });

  it("groups places within 30 m, whatever their names", () => {
    const g = duplicateGroups([
      loc(32, "Alexanderplatz", "Berlin", 52.52186, 13.41321),
      loc(63, "Alexanderplatz (World Clock)", "Berlin", 52.52195, 13.41335), // ~14 m away
      loc(70, "Fernsehturm", "Berlin", 52.52082, 13.40940), // ~290 m away
    ]);
    expect(g.map((x) => x.ids)).toEqual([[32, 63]]);
  });

  it("joins chains into one group and lists the lowest id first", () => {
    const g = duplicateGroups([
      loc(9, "Tempelhof Airport", "Berlin", null, null),
      loc(3, "Tempelhof Airport", "Berlin", 52.4731, 13.4039),
      loc(5, "Flughafen Tempelhof", "Berlin", 52.47312, 13.40392),
    ]);
    expect(g.map((x) => x.ids)).toEqual([[3, 5, 9]]);
  });

  it("returns nothing when every place is distinct", () => {
    expect(duplicateGroups([loc(1, "A", "Berlin", 52, 13), loc(2, "B", "Berlin", 52.01, 13)])).toEqual([]);
  });
});
