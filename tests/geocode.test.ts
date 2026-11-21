import { describe, expect, it } from "vitest";
import { isCoarse, placeType, type NominatimHit } from "@/lib/geocode";

const hit = (category: string, type: string, addresstype?: string): NominatimHit => ({
  lat: "52.5", lon: "13.4", display_name: "x", category, type, addresstype,
});

describe("isCoarse", () => {
  it.each([
    ["suburb", hit("place", "suburb", "suburb")],
    ["district", hit("boundary", "administrative", "city_district")],
    ["city", hit("place", "city", "city")],
    ["road", hit("highway", "residential", "road")],
    ["quarter by addresstype", hit("landuse", "residential", "quarter")],
  ])("flags a %s", (_, h) => {
    expect(isCoarse(h)).toBe(true);
  });
  it.each([
    ["school", hit("amenity", "school", "amenity")],
    ["bridge", hit("man_made", "bridge", "man_made")],
    ["museum", hit("tourism", "museum", "tourism")],
    ["no addresstype", hit("building", "yes")],
  ])("accepts a %s", (_, h) => {
    expect(isCoarse(h)).toBe(false);
  });
});

describe("placeType", () => {
  it("shows category/type and addresstype", () => {
    expect(placeType(hit("amenity", "school", "amenity"))).toBe("amenity/school (amenity)");
    expect(placeType({ lat: "0", lon: "0", display_name: "" })).toBe("unknown");
  });
});
