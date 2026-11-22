import { describe, expect, it } from "vitest";
import { cityCount, pickPlaces, type Candidate } from "@/lib/curate";

const c = (id: number, city: string, works: string[], checkIn = false, photo = false): Candidate => ({ id, city, works, checkIn, photo });

describe("pickPlaces", () => {
  it("prefers check-in grade, then a photo, then the lowest id", () => {
    const got = pickPlaces([c(1, "B", ["a"]), c(2, "B", ["b"], false, true), c(3, "B", ["c"], true), c(4, "B", ["d"], true, true)], { max: 3, perTitle: 2 });
    expect(got.map((x) => x.id)).toEqual([4, 3, 2]);
  });
  it("takes at most perTitle places of one title, counting every title of a shared place", () => {
    const got = pickPlaces([c(1, "B", ["a"], true), c(2, "B", ["a", "b"], true), c(3, "B", ["a"]), c(4, "B", ["b"]), c(5, "B", ["b"])], { max: 10, perTitle: 2 });
    expect(got.map((x) => x.id)).toEqual([1, 2, 4]);
  });
  it("skips places without a title and lists each place once", () => {
    expect(pickPlaces([c(1, "B", []), c(2, "B", ["a"]), c(2, "B", ["a"])], { max: 5, perTitle: 3 }).map((x) => x.id)).toEqual([2]);
  });
  it("spreads over cities, one per city in turn, biggest city first", () => {
    const all = [c(1, "Berlin", ["a"], true), c(2, "Berlin", ["b"], true), c(3, "Berlin", ["c"], true), c(4, "Görlitz", ["d"], true), c(5, "Potsdam", ["e"], true)];
    const got = pickPlaces(all, { max: 4, perTitle: 1, spreadCities: true });
    expect(got.map((x) => x.id)).toEqual([1, 4, 5, 2]);
    expect(cityCount(got)).toBe(3);
  });
  it("stops when nothing more fits", () => {
    expect(pickPlaces([c(1, "B", ["a"]), c(2, "G", ["a"])], { max: 12, perTitle: 1, spreadCities: true })).toHaveLength(1);
  });
});
