import { describe, expect, it } from "vitest";
import { canCheckIn, distanceBand, formatDistance, haversineKm, isWithinCheckIn, sortByDistance } from "@/lib/distance";

const alex = { lat: 52.522133, lng: 13.41345 };
const brandenburgGate = { lat: 52.516275, lng: 13.377704 };
const goerlitz = { lat: 51.1557, lng: 14.989 };

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(alex, alex)).toBe(0);
  });
  it("Alexanderplatz to Brandenburg Gate is about 2.5 km", () => {
    expect(haversineKm(alex, brandenburgGate)).toBeCloseTo(2.5, 1);
  });
  it("Berlin to Görlitz is about 180 km and symmetric", () => {
    const d = haversineKm(alex, goerlitz);
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(190);
    expect(haversineKm(goerlitz, alex)).toBeCloseTo(d, 9);
  });
});

describe("distanceBand", () => {
  it.each([
    [0, "Near you"],
    [1.99, "Near you"],
    [2, "Day trip"],
    [29.9, "Day trip"],
    [30, "Weekend by train"],
    [249, "Weekend by train"],
    [250, "Big trip"],
    [900, "Big trip"],
  ])("%s km -> %s", (km, label) => {
    expect(distanceBand(km).label).toBe(label);
  });
});

describe("formatDistance", () => {
  it("uses one decimal under 10 km and whole km above", () => {
    expect(formatDistance(0.34)).toBe("about 0.3 km");
    expect(formatDistance(9.96)).toBe("about 10.0 km");
    expect(formatDistance(182.4)).toBe("about 182 km");
  });
});

describe("sortByDistance", () => {
  it("drops rows without coordinates and sorts closest first", () => {
    const rows = [
      { id: 1, ...goerlitz },
      { id: 2, lat: null, lng: null },
      { id: 3, ...brandenburgGate },
    ];
    const sorted = sortByDistance(rows, alex);
    expect(sorted.map((r) => r.id)).toEqual([3, 1]);
    expect(sorted[0].distanceKm).toBeCloseTo(2.5, 1);
  });
});

describe("isWithinCheckIn", () => {
  it("accepts within 200 m and refuses beyond", () => {
    expect(isWithinCheckIn(alex, { lat: alex.lat + 0.0015, lng: alex.lng })).toBe(true); // ~167 m
    expect(isWithinCheckIn(alex, { lat: alex.lat + 0.0025, lng: alex.lng })).toBe(false); // ~278 m
  });
  it("also accepts anywhere inside a large site's bounding box", () => {
    const tempelhof = { lat: 52.4731, lng: 13.4039, bbox: [52.465, 13.39, 52.482, 13.42] as [number, number, number, number] };
    expect(isWithinCheckIn({ lat: 52.479, lng: 13.415 }, tempelhof)).toBe(true); // ~950 m from the point, inside the box
    expect(isWithinCheckIn({ lat: 52.49, lng: 13.415 }, tempelhof)).toBe(false); // outside the box, far from the point
  });
});

describe("canCheckIn", () => {
  const at = { lat: 52.5, lng: 13.4 };
  it("allows source, verified and checked landmark (geocoded_poi) coordinates only", () => {
    expect(canCheckIn({ ...at, coord_quality: "source" })).toBe(true);
    expect(canCheckIn({ ...at, coord_quality: "verified" })).toBe(true);
    expect(canCheckIn({ ...at, coord_quality: "geocoded_poi" })).toBe(true);
    expect(canCheckIn({ ...at, coord_quality: "geocoded" })).toBe(false);
    expect(canCheckIn({ ...at, coord_quality: "approx" })).toBe(false);
    expect(canCheckIn({ ...at, coord_quality: null })).toBe(false);
  });
  it("refuses without coordinates even if marked verified", () => {
    expect(canCheckIn({ lat: null, lng: null, coord_quality: "verified" })).toBe(false);
  });
});
