import { describe, expect, it } from "vitest";
import { applyFilters, buildMapPlaces, initials, markerLabel, thumbAt } from "@/lib/explore-map";
import type { LiveLocation } from "@/lib/nearby";

const works = [{ id: "dark", title: "Dark" }, { id: "bb", title: "Babylon Berlin" }, { id: "gb", title: "The Grand Budapest Hotel" }];
const loc = (id: number, work_id: string, city: string, lat: number, lng: number, o: Partial<LiveLocation> = {}): LiveLocation =>
  ({ id, work_id, name: `P${id}`, city, lat, lng, coord_quality: "source", ...o });

describe("buildMapPlaces", () => {
  it("makes one marker per place with every title, photo, check-in and badge", () => {
    const places = buildMapPlaces([
      loc(1, "dark", "Berlin", 52.5, 13.4, { verification_method: "ai", image_thumb_url: "https://upload.wikimedia.org/x.jpg", image_source_page: "https://commons.wikimedia.org/x", image_author: "A", image_license: "CC BY 4.0" }),
      loc(1, "bb", "Berlin", 52.5, 13.4),
      loc(2, "gb", "Görlitz", 51.15, 14.98, { coord_quality: "approx" }),
      loc(3, "unknown", "Berlin", 52.5, 13.4),
      loc(4, "dark", "Berlin", null as unknown as number, 13.4),
    ], works);
    expect(places.map((p) => [p.id, p.titles.map((t) => t.id), p.checkIn, p.verifiedBy, !!p.photo])).toEqual([
      [1, ["dark", "bb"], true, "ai", true],
      [2, ["gb"], false, null, false],
    ]);
    expect(markerLabel(places[0])).toBe("P1 — Dark, Babylon Berlin");
  });
});

describe("marker details", () => {
  it("initials skip a leading article", () => {
    expect(initials("The Grand Budapest Hotel")).toBe("GB");
    expect(initials("Dark")).toBe("DA");
    expect(initials("Babylon Berlin")).toBe("BB");
    expect(initials("The Reader")).toBe("RE");
  });
  it("asks Commons for a small thumbnail, never the full image", () => {
    expect(thumbAt("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/640px-F.jpg", 88))
      .toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/120px-F.jpg");
    expect(thumbAt("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/960px-F.jpg?utm_source=x", 460))
      .toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/500px-F.jpg"); // query dropped, width Wikimedia serves
    // A small original: a thumbnail is built for marker sizes, the original is kept for big ones.
    expect(thumbAt("https://upload.wikimedia.org/wikipedia/commons/a/ab/F.jpg?utm_source=x", 88)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/120px-F.jpg");
    expect(thumbAt("https://upload.wikimedia.org/wikipedia/commons/a/ab/F.jpg", 460)).toBe("https://upload.wikimedia.org/wikipedia/commons/a/ab/F.jpg");
    expect(thumbAt("https://example.com/F.jpg", 88)).toBe("https://example.com/F.jpg");
  });
});

describe("applyFilters", () => {
  const places = buildMapPlaces([loc(1, "dark", "Berlin", 52.52, 13.405), loc(2, "bb", "Berlin", 52.4, 13.05), loc(3, "gb", "Görlitz", 51.15, 14.98)], works);
  const none = { title: null, collection: null, city: null, radiusKm: null };
  it("shows everything without filters", () => {
    expect(applyFilters(places, none, null).map((m) => [m.place.id, m.highlighted, m.faded])).toEqual([[1, false, false], [2, false, false], [3, false, false]]);
  });
  it("a title highlights its places and fades the rest; it hides nothing", () => {
    expect(applyFilters(places, { ...none, title: "bb" }, null).map((m) => [m.place.id, m.highlighted, m.faded])).toEqual([[1, false, true], [2, true, false], [3, false, true]]);
  });
  it("collection, city and radius hide places", () => {
    expect(applyFilters(places, { ...none, collection: { placeIds: [1, 3] } }, null).map((m) => m.place.id)).toEqual([1, 3]);
    expect(applyFilters(places, { ...none, city: "Görlitz" }, null).map((m) => m.place.id)).toEqual([3]);
    expect(applyFilters(places, { ...none, radiusKm: 5 }, { lat: 52.52, lng: 13.405 }).map((m) => m.place.id)).toEqual([1]);
    expect(applyFilters(places, { ...none, radiusKm: 5 }, null)).toHaveLength(3); // no origin: radius can't apply
  });
});

describe("map markers", () => {
  it("uses a round Commons thumbnail when there is one, initials otherwise", async () => {
    const { markerHtml, markerThumb, clusterHtml } = await import("@/lib/map-markers");
    const thumb = markerThumb("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/960px-F.jpg?utm_source=x");
    expect(thumb).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.jpg/120px-F.jpg");
    expect(markerThumb("https://example.com/x.jpg")).toBeNull();
    expect(markerHtml({ thumb, label: "Babylon Berlin", aria: "P" })).toContain('<img src="https://upload.wikimedia.org/');
    expect(markerHtml({ thumb: null, label: "Babylon Berlin", aria: "P" })).toContain(">BB</span>");
    expect(clusterHtml(thumb, 7)).toMatch(/<img src=.*>7<\/span>/);
  });
});
