import { describe, expect, it } from "vitest";
import { buildNearby } from "@/lib/nearby";
import { BERLIN, GOERLITZ } from "./fixtures/cities";
import { buildCardData, mapPlaces, MAX_STAMPS, projectDots, shareText, TITLE_COLOURS } from "@/lib/share-card";
import type { Collection, Work } from "@/lib/types";

const works: Work[] = [
  { id: "bourne", title: "The Bourne Supremacy", type: "film", aliases: [], year: null },
  { id: "dark", title: "Dark", type: "series", aliases: [], year: null },
  { id: "budapest", title: "The Grand Budapest Hotel", type: "film", aliases: [], year: null },
];
const nearby = buildNearby(
  [
    { id: 1, work_id: "bourne", name: "Alexanderplatz", city: "Berlin", lat: 52.522133, lng: 13.41345, coord_quality: "source" },
    { id: 2, work_id: "bourne", name: "Ostbahnhof", city: "Berlin", lat: 52.5103, lng: 13.4347, coord_quality: "approx" },
    { id: 3, work_id: "dark", name: "Stahnsdorf", city: "Stahnsdorf", lat: 52.385, lng: 13.205, coord_quality: "approx" },
    { id: 4, work_id: "budapest", name: "Kaufhaus Görlitz", city: "Görlitz", lat: 51.153, lng: 14.987, coord_quality: "approx" },
  ],
  works,
  BERLIN,
);
const stamp = (workId: string, visited = false) => ({
  workId, title: works.find((w) => w.id === workId)!.title, places: nearby.places.filter((p) => p.workId === workId), visited,
});
const coldWar: Collection = { id: "cw", name: "Cold War Berlin", city: "Berlin", work_ids: ["bourne", "x", "y", "z"], description: null };

describe("buildCardData", () => {
  const card = buildCardData({
    cityName: "Berlin", displayName: null, collections: [coldWar],
    stamps: [stamp("bourne", true), stamp("dark"), stamp("budapest")],
  });
  it("counts places and builds one stamp per title with its own colour", () => {
    expect(card.placeCount).toBe(4);
    expect(card.stamps.map((s) => [s.title, s.places, s.visited, s.colour])).toEqual([
      ["The Bourne Supremacy", 2, true, TITLE_COLOURS[0]],
      ["Dark", 1, false, TITLE_COLOURS[1]],
      ["The Grand Budapest Hotel", 1, false, TITLE_COLOURS[2]],
    ]);
  });
  it("keeps the dot map local and colours dots by title", () => {
    expect(card.dots).toHaveLength(3); // Görlitz is 180 km away
    expect(card.dots.filter((d) => d.colour === TITLE_COLOURS[0])).toHaveLength(2);
  });
  it("writes the closest place and collection lines", () => {
    expect(card.closest).toBe("Closest: Alexanderplatz (The Bourne Supremacy), about 0.6 km");
    expect(card.collection).toBe("Cold War Berlin 1/4");
  });
  it("counts a place shared by two titles once, with one dot", () => {
    const shared = buildNearby(
      [
        { id: 1, work_id: "bourne", name: "Alexanderplatz", city: "Berlin", lat: 52.522133, lng: 13.41345, coord_quality: "source" },
        { id: 1, work_id: "dark", name: "Alexanderplatz", city: "Berlin", lat: 52.522133, lng: 13.41345, coord_quality: "source" },
      ],
      works,
      BERLIN,
    );
    const two = buildCardData({
      cityName: "Berlin", displayName: null, collections: [],
      stamps: ["bourne", "dark"].map((id) => ({ workId: id, title: id, places: shared.places.filter((p) => p.workId === id), visited: false })),
    });
    expect(two.placeCount).toBe(1);
    expect(two.dots).toHaveLength(1);
    expect(two.stamps.map((s) => s.places)).toEqual([1, 1]);
  });
  it("caps stamps and counts the rest", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...stamp("dark"), workId: `w${i}` }));
    const c = buildCardData({ cityName: "Berlin", displayName: null, collections: [], stamps: many });
    expect(c.stamps).toHaveLength(MAX_STAMPS - 1);
    expect(c.moreStamps).toBe(3);
    const six = buildCardData({ cityName: "Berlin", displayName: null, collections: [], stamps: many.slice(0, 6) });
    expect([six.stamps.length, six.moreStamps]).toEqual([6, 0]);
    expect(c.collection).toBeNull();
  });
  it("handles an empty passport", () => {
    const c = buildCardData({ cityName: "Berlin", displayName: null, collections: [], stamps: [] });
    expect(c).toMatchObject({ placeCount: 0, stamps: [], dots: [], closest: null, collection: null });
  });
});

describe("mapPlaces", () => {
  it("falls back to all places when fewer than 2 are local", () => {
    const fromGoerlitz = buildNearby(nearby.places.map((p) => ({ id: p.id, work_id: p.workId, name: p.name, city: p.city, lat: p.lat, lng: p.lng, coord_quality: p.coordQuality })), works, GOERLITZ);
    expect(mapPlaces(fromGoerlitz.places)).toHaveLength(4);
  });
});

describe("projectDots", () => {
  const c = "#fff";
  it("fits dots inside the box with padding", () => {
    const pts = projectDots([{ lat: 52.5, lng: 13.3, colour: c }, { lat: 52.4, lng: 13.5, colour: c }, { lat: 52.6, lng: 13.4, colour: c }], 900, 500, 40);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(40 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(860 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(40 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(460 + 1e-9);
    }
    expect(pts[2].y).toBeLessThan(pts[1].y); // north is up
  });
  it("centres a single dot and returns nothing for no dots", () => {
    expect(projectDots([{ lat: 52.5, lng: 13.4, colour: c }], 900, 500, 40)).toEqual([{ x: 450, y: 250, colour: c }]);
    expect(projectDots([], 900, 500, 40)).toEqual([]);
  });
});

describe("shareText", () => {
  it("matches the skill's copy", () => {
    expect(shareText(18, "Berlin", "https://x.app")).toBe("My Screen Passport: 18 places from my films near Berlin. Find yours: https://x.app");
    expect(shareText(1, "Berlin", "https://x.app")).toContain("1 place from");
  });
});
