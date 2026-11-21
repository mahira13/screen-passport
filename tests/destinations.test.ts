import { describe, expect, it } from "vitest";
import { destinations } from "@/lib/destinations";
import type { LiveLocation } from "@/lib/nearby";

const loc = (id: number, work_id: string, city: string | null): LiveLocation => ({
  id, work_id, name: `Place ${id}`, city, lat: 52, lng: 13, coord_quality: "source",
});

describe("destinations", () => {
  it("counts places and distinct titles per city, most places first", () => {
    const d = destinations([
      loc(1, "dark", "Berlin"), loc(2, "dark", "Berlin"), loc(3, "babylon", "Berlin"),
      loc(4, "grand-budapest", "Görlitz"), loc(5, "the-reader", "Görlitz"),
      loc(6, "dark", "Stahnsdorf"),
    ]);
    expect(d.map((x) => [x.city, x.places, x.titles])).toEqual([
      ["Berlin", 3, 2], ["Görlitz", 2, 2], ["Stahnsdorf", 1, 1],
    ]);
  });

  it("links a city to the city picker when it is a start city, ignoring case and accents", () => {
    const d = destinations([loc(1, "a", "berlin"), loc(2, "b", "Gorlitz"), loc(3, "c", "Stahnsdorf")]);
    expect(Object.fromEntries(d.map((x) => [x.city, x.cityId]))).toEqual({ berlin: "berlin", Gorlitz: "goerlitz", Stahnsdorf: null });
  });

  it("skips rows without a city and respects the limit", () => {
    const d = destinations([loc(1, "a", null), loc(2, "a", " "), loc(3, "a", "Berlin"), loc(4, "b", "Köln")], 1);
    expect(d).toHaveLength(1);
    expect(d[0].city).toBe("Berlin");
  });
});
