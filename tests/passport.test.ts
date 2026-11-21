import { describe, expect, it } from "vitest";
import { isPassportId, randomEditKey, randomId } from "@/lib/ids";
import { buildNearby } from "@/lib/nearby";
import { cleanStartCity, cleanWatched, EMPTY_PASSPORT, parseLocalPassport, passportSummary, toggleId } from "@/lib/passport";
import { editKeyMatches, hashEditKey } from "@/lib/passport-server";
import { DEFAULT_CITY } from "@/lib/cities";
import type { Work } from "@/lib/types";

describe("ids", () => {
  it("makes 12-character ids from a readable alphabet", () => {
    const ids = Array.from({ length: 500 }, () => randomId());
    expect(ids.every(isPassportId)).toBe(true);
    expect(new Set(ids).size).toBe(500);
    expect(ids.join("")).not.toMatch(/[01lIO]/);
  });
  it("rejects anything else as a passport id", () => {
    expect(isPassportId("short")).toBe(false);
    expect(isPassportId("abcdefghijk0")).toBe(false); // 0 not in alphabet
    expect(isPassportId("../../etc/pa")).toBe(false);
    expect(isPassportId(123)).toBe(false);
  });
  it("edit keys are long and different from each other", () => {
    expect(randomEditKey()).toHaveLength(32);
    expect(randomEditKey()).not.toBe(randomEditKey());
  });
});

describe("edit key", () => {
  it("matches only the right key and never stores it in clear", () => {
    const h = hashEditKey("secret-key");
    expect(h).not.toContain("secret-key");
    expect(editKeyMatches("secret-key", h)).toBe(true);
    expect(editKeyMatches("other", h)).toBe(false);
    expect(editKeyMatches("secret-key", null)).toBe(false);
    expect(editKeyMatches(undefined, h)).toBe(false);
  });
});

describe("toggleId", () => {
  it("adds and removes", () => {
    expect(toggleId([], "dark")).toEqual(["dark"]);
    expect(toggleId(["dark", "unorthodox"], "dark")).toEqual(["unorthodox"]);
  });
});

describe("cleanWatched", () => {
  const known = new Set(["dark", "unorthodox"]);
  it("dedupes and keeps known ids only", () => {
    expect(cleanWatched(["dark", "dark", "nope", "unorthodox"], known)).toEqual(["dark", "unorthodox"]);
  });
  it("rejects non-lists and non-strings", () => {
    expect(cleanWatched("dark", known)).toBeNull();
    expect(cleanWatched([1, 2], known)).toBeNull();
    expect(cleanWatched(Array(1000).fill("dark"), known)).toBeNull();
  });
});

describe("cleanStartCity", () => {
  it("keeps our city ids only", () => {
    expect(cleanStartCity("berlin")).toBe("berlin");
    expect(cleanStartCity("me")).toBeNull();
    expect(cleanStartCity({ lat: 1 })).toBeNull();
  });
});

describe("parseLocalPassport", () => {
  it("reads a saved passport and survives junk", () => {
    expect(parseLocalPassport('{"id":"abc","editKey":"k","watched":["dark",5],"startCity":"berlin"}')).toEqual({
      id: "abc", editKey: "k", watched: ["dark"], startCity: "berlin",
    });
    expect(parseLocalPassport(null)).toBe(EMPTY_PASSPORT);
    expect(parseLocalPassport("{not json")).toBe(EMPTY_PASSPORT);
    expect(parseLocalPassport('{"watched":"dark"}').watched).toEqual([]);
  });
});

describe("passportSummary", () => {
  const works: Work[] = [
    { id: "bourne", title: "The Bourne Supremacy", type: "film", aliases: [], year: null },
    { id: "dark", title: "Dark", type: "series", aliases: [], year: null },
  ];
  const nearby = buildNearby(
    [
      { id: 1, work_id: "bourne", name: "Alexanderplatz", city: null, lat: 52.522133, lng: 13.41345, coord_quality: "source" },
      { id: 2, work_id: "bourne", name: "Ostbahnhof", city: null, lat: 52.5103, lng: 13.4347, coord_quality: "approx" },
      { id: 3, work_id: "dark", name: "Stahnsdorf", city: null, lat: 52.385, lng: 13.205, coord_quality: "approx" },
    ],
    works,
    DEFAULT_CITY,
  );
  it("counts titles, their live places and the closest one", () => {
    const s = passportSummary(["bourne", "dark"], nearby);
    expect(s).toMatchObject({ titles: 2, places: 3 });
    expect(s.closestKm).toBeCloseTo(0.6, 1);
  });
  it("counts a watched title with no live places", () => {
    expect(passportSummary(["other"], nearby)).toEqual({ titles: 1, places: 0, closestKm: null });
  });
});
