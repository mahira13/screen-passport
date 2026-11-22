import { describe, expect, it } from "vitest";
import { locationPage, titlePage } from "@/lib/catalogue-pages";
import type { LiveLocation } from "@/lib/nearby";
import type { Work } from "@/lib/types";

const works: Work[] = [
  { id: "dark", title: "Dark", type: "series", aliases: [], year: 2017 },
  { id: "bb", title: "Babylon Berlin", type: "series", aliases: [], year: 2017 },
  { id: "empty", title: "No places", type: "film", aliases: [], year: null },
];
const loc = (id: number, work_id: string, city: string, country: string, extra: Partial<LiveLocation> = {}): LiveLocation => ({
  id, work_id, name: `Place ${id}`, city, country, lat: 52 + id / 100, lng: 13, coord_quality: "source", ...extra,
});
const rows: LiveLocation[] = [
  loc(1, "dark", "Berlin", "Germany", { scene_note: "Winden caves", depicts: "the caves" }),
  loc(2, "dark", "Berlin", "Germany"),
  loc(3, "dark", "Görlitz", "Germany"),
  loc(4, "dark", "Prague", "Czechia"),
  loc(1, "bb", "Berlin", "Germany", { scene_note: "Rotes Rathaus as police HQ", source_url: "https://example.org/bb" }),
  loc(5, "bb", "Berlin", "Germany", { lat: null }),
];

describe("titlePage", () => {
  it("groups places by country and city, biggest first", () => {
    const t = titlePage("dark", works, rows)!;
    expect(t.places.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(t.countries.map((c) => [c.country, c.count])).toEqual([["Germany", 3], ["Czechia", 1]]);
    expect(t.countries[0].cities.map((c) => [c.city, c.places.length])).toEqual([["Berlin", 2], ["Görlitz", 1]]);
    expect(t.mainCity).toBe("Berlin");
  });
  it("is null for unknown titles or titles without mappable places", () => {
    expect(titlePage("nope", works, rows)).toBeNull();
    expect(titlePage("empty", works, rows)).toBeNull();
  });
});

describe("locationPage", () => {
  it("lists every title filmed at the place with its own scene and evidence", () => {
    const l = locationPage(1, works, rows)!;
    expect(l.titles.map((t) => [t.workId, t.sceneNote])).toEqual([["bb", "Rotes Rathaus as police HQ"], ["dark", "Winden caves"]]);
    expect(l.titles[0].sourceUrl).toBe("https://example.org/bb");
    expect(l.place.id).toBe(1);
    expect(l.checkIn).toBe(true);
    expect(l.access).toBe("unknown");
  });
  it("offers no check-in on approximate pins", () => {
    expect(locationPage(2, works, [loc(2, "dark", "Berlin", "Germany", { coord_quality: "geocoded" })])!.checkIn).toBe(false);
  });
  it("is null for unpublished or unmappable places", () => {
    expect(locationPage(99, works, rows)).toBeNull();
    expect(locationPage(5, works, rows)).toBeNull();
  });
});
