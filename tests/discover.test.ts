import { describe, expect, it } from "vitest";
import { autoRadius, centreOf, emptyMessage, parseRadius, popularTitles, radiusLabel, RADII, widerRadius } from "@/lib/discover";

describe("radius chips", () => {
  it("are 5 · 10 · 25 · 50 km · Anywhere", () => {
    expect(RADII.map(radiusLabel)).toEqual(["5 km", "10 km", "25 km", "50 km", "Anywhere"]);
  });
  it("parses only chip values", () => {
    expect(parseRadius("25")).toBe(25);
    expect(parseRadius("7")).toBeNull();
    expect(parseRadius("")).toBeNull();
    expect(parseRadius(null)).toBeNull();
    expect(parseRadius("1e9")).toBeNull();
  });
  it("widens one step at a time", () => {
    expect(widerRadius(5)).toBe(10);
    expect(widerRadius(50)).toBeNull();
    expect(widerRadius(null)).toBeUndefined();
  });
});

describe("emptyMessage", () => {
  it("suggests the next chip or a collection", () => {
    expect(emptyMessage(10)).toBe("No verified locations within 10 km. Try 25 km or explore a collection.");
    expect(emptyMessage(50)).toBe("No verified locations within 50 km. Try searching anywhere or explore a collection.");
    expect(emptyMessage(null)).toMatch(/collection/);
  });
});

describe("popularTitles", () => {
  const works = [
    { id: "dark", title: "Dark", type: "series" },
    { id: "bb", title: "Babylon Berlin", type: "series" },
    { id: "spies", title: "Bridge of Spies", type: "film" },
    { id: "none", title: "No places", type: "film" },
  ];
  const places = new Map([["dark", 4], ["bb", 9], ["spies", 2]]);
  it("ranks by passports (each passport once), then places; skips titles without places", () => {
    const r = popularTitles([["spies", "spies", "dark"], ["spies"], ["none", "none"]], works, places);
    expect(r.map((t) => [t.workId, t.passports])).toEqual([["spies", 2], ["dark", 1], ["bb", 0]]);
  });
  it("falls back to places when nobody has marked anything", () => {
    expect(popularTitles([], works, places, 2).map((t) => t.workId)).toEqual(["bb", "dark"]);
  });
});

describe("centreOf", () => {
  it("averages points, rounded to about 100 m", () => {
    expect(centreOf([{ lat: 52, lng: 13 }, { lat: 53, lng: 14 }])).toEqual({ lat: 52.5, lng: 13.5 });
    expect(centreOf([])).toBeNull();
  });
});

describe("autoRadius", () => {
  const at = (id: number, distanceKm: number) => ({ id, distanceKm });
  it("picks the smallest chip with at least 3 places", () => {
    expect(autoRadius([at(1, 1), at(2, 4), at(3, 4.9), at(4, 40)])).toBe(5);
    expect(autoRadius([at(1, 1), at(2, 8), at(3, 20)])).toBe(25);
    expect(autoRadius([at(1, 49), at(2, 50), at(3, 50)])).toBe(50);
  });
  it("counts a place once even when several titles were filmed there", () => {
    expect(autoRadius([at(1, 1), at(1, 1), at(1, 1), at(2, 3), at(3, 9)])).toBe(10);
  });
  it("falls back to Anywhere", () => {
    expect(autoRadius([at(1, 1), at(2, 2), at(3, 51)])).toBeNull();
    expect(autoRadius([])).toBeNull();
  });
});

