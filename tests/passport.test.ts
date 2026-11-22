import { describe, expect, it } from "vitest";
import { isPassportId, randomEditKey, randomId } from "@/lib/ids";
import { buildNearby } from "@/lib/nearby";
import {
  checkInIds, cleanStartCity, cleanVisited, cleanWatched, EMPTY_PASSPORT, parseLocalPassport, passportSummary, toggleId,
} from "@/lib/passport";
import { editKeyMatches, hashEditKey } from "@/lib/passport-server";
import { BERLIN as DEFAULT_CITY, CITIES } from "./fixtures/cities";
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

describe("checkInIds", () => {
  it("allows check-in only where coordinates come from the source or were verified", () => {
    const ids = checkInIds([
      { id: 1, work_id: "a", name: "A", city: null, lat: 52, lng: 13, coord_quality: "source" },
      { id: 2, work_id: "a", name: "B", city: null, lat: 52, lng: 13, coord_quality: "verified" },
      { id: 3, work_id: "a", name: "C", city: null, lat: 52, lng: 13, coord_quality: "approx" },
      { id: 4, work_id: "a", name: "D", city: null, lat: 52, lng: 13, coord_quality: "geocoded" },
      { id: 5, work_id: "a", name: "E", city: null, lat: null, lng: null, coord_quality: "source" },
    ]);
    expect([...ids].sort()).toEqual([1, 2]);
  });
});

describe("cleanVisited", () => {
  const eligible = new Set([1, 2, 3]);
  it("keeps eligible place ids, deduped", () => {
    expect(cleanVisited([2, 2, 9, 1], eligible, [])).toEqual([2, 1]);
  });
  it("keeps places already in the passport even if they are no longer eligible", () => {
    expect(cleanVisited([9, 1], eligible, [9])).toEqual([9, 1]);
  });
  it("rejects anything that isn't a list of positive whole numbers", () => {
    expect(cleanVisited("1", eligible, [])).toBeNull();
    expect(cleanVisited([1, "2"], eligible, [])).toBeNull();
    expect(cleanVisited([1.5], eligible, [])).toBeNull();
    expect(cleanVisited(Array(2000).fill(1), eligible, [])).toBeNull();
  });
});

describe("cleanStartCity", () => {
  it("keeps our city ids only", () => {
    expect(cleanStartCity("berlin", CITIES)).toBe("berlin");
    expect(cleanStartCity("me", CITIES)).toBeNull();
    expect(cleanStartCity({ lat: 1 }, CITIES)).toBeNull();
  });
});

describe("parseLocalPassport", () => {
  it("reads a saved passport and survives junk", () => {
    expect(parseLocalPassport('{"id":"abc","editKey":"k","watched":["dark",5],"startCity":"berlin"}')).toEqual({
      id: "abc", editKey: "k", watched: ["dark"], visited: [], startCity: "berlin", stampedAt: {},
    });
    expect(parseLocalPassport('{"stampedAt":{"3":"2026-11-22","x":"2026-11-22","4":"today","5":7}}').stampedAt).toEqual({ "3": "2026-11-22" });
    expect(parseLocalPassport('{"watched":[],"visited":[3,"4",3.5,-1,3,7]}').visited).toEqual([3, 7]);
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
  it("counts a place shared by two watched titles once", () => {
    const shared = buildNearby(
      [
        { id: 1, work_id: "bourne", name: "Alexanderplatz", city: null, lat: 52.522133, lng: 13.41345, coord_quality: "source" },
        { id: 1, work_id: "dark", name: "Alexanderplatz", city: null, lat: 52.522133, lng: 13.41345, coord_quality: "source" },
      ],
      works,
      DEFAULT_CITY,
    );
    expect(passportSummary(["bourne", "dark"], shared)).toMatchObject({ titles: 2, places: 1 });
  });
  it("counts a watched title with no live places", () => {
    expect(passportSummary(["other"], nearby)).toEqual({ titles: 1, places: 0, closestKm: null });
  });
});
