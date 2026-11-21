import { describe, expect, it } from "vitest";
import { CITIES, DEFAULT_CITY, findCity } from "@/lib/cities";
import { buildNearby, initialMapPlaces, titlesByBand, type LiveLocation } from "@/lib/nearby";
import type { Work } from "@/lib/types";

const works: Work[] = [
  { id: "bourne", title: "The Bourne Supremacy", type: "film", aliases: [], year: null },
  { id: "dark", title: "Dark", type: "series", aliases: [], year: null },
  { id: "budapest", title: "The Grand Budapest Hotel", type: "film", aliases: [], year: null },
];
const loc = (id: number, work_id: string, lat: number | null, lng: number | null): LiveLocation => ({
  id, work_id, name: `Place ${id}`, city: null, lat, lng, coord_quality: lat === null ? null : "approx",
});
const locations = [
  loc(1, "bourne", 52.522133, 13.41345), // Alexanderplatz, ~0.6 km from Berlin centre
  loc(2, "bourne", 52.5103, 13.4347), // Ostbahnhof, ~2.3 km
  loc(3, "dark", 52.385, 13.205), // Stahnsdorf, ~20 km
  loc(4, "dark", null, null), // not geocoded yet
  loc(5, "budapest", 51.153, 14.987), // Görlitz, ~180 km
  loc(6, "unknown-work", 52.52, 13.405),
];

describe("buildNearby", () => {
  const r = buildNearby(locations, works, DEFAULT_CITY);

  it("sorts places by distance and skips rows without coordinates or work", () => {
    expect(r.places.map((p) => p.id)).toEqual([1, 2, 3, 5]);
    expect(r.places.map((p) => p.band)).toEqual(["near", "day", "day", "weekend"]);
  });
  it("groups by title with place count and closest place", () => {
    expect(r.titles.map((t) => [t.workId, t.placeCount, t.closest.id])).toEqual([
      ["bourne", 2, 1],
      ["dark", 1, 3],
      ["budapest", 1, 5],
    ]);
    expect(r.titles[1].type).toBe("series");
  });
  it("changes order with the start point", () => {
    const fromGoerlitz = buildNearby(locations, works, findCity("goerlitz")!);
    expect(fromGoerlitz.titles[0].workId).toBe("budapest");
    expect(fromGoerlitz.titles[0].closest.band).toBe("near");
  });
  it("returns empty lists when nothing is live", () => {
    expect(buildNearby([], works, DEFAULT_CITY)).toEqual({ places: [], titles: [] });
  });
});

describe("titlesByBand", () => {
  it("puts each title under its closest place's band, in band order, skipping empty bands", () => {
    const groups = titlesByBand(buildNearby(locations, works, DEFAULT_CITY).titles);
    expect(groups.map((g) => [g.label, g.titles.map((t) => t.workId)])).toEqual([
      ["Near you", ["bourne"]],
      ["Day trip", ["dark"]],
      ["Weekend by train", ["budapest"]],
    ]);
  });
});

describe("initialMapPlaces", () => {
  it("shows places within 30 km, or the closest 3", () => {
    const r = buildNearby(locations, works, DEFAULT_CITY);
    expect(initialMapPlaces(r.places).map((p) => p.id)).toEqual([1, 2, 3]);
    expect(initialMapPlaces(buildNearby(locations, works, findCity("hamburg")!).places)).toHaveLength(3);
  });
});

describe("cities", () => {
  it("defaults to Berlin and has unique ids", () => {
    expect(DEFAULT_CITY.name).toBe("Berlin");
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    expect(findCity("nope")).toBeUndefined();
  });
});
