import { describe, expect, it } from "vitest";
import { googleMapsRouteUrl, kmBetweenStops, orderNearestNext } from "@/lib/route";

const start = { lat: 52.52, lng: 13.405 }; // Berlin centre
const far = { id: "far", lat: 52.4, lng: 13.05 }; // Potsdam-ish
const near = { id: "near", lat: 52.521, lng: 13.41 };
const mid = { id: "mid", lat: 52.5, lng: 13.3 };

describe("orderNearestNext", () => {
  it("always goes to the closest unvisited stop", () => {
    expect(orderNearestNext(start, [far, near, mid]).map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });
  it("adds km from the previous stop, from the start for the first", () => {
    const [a, b] = orderNearestNext(start, [mid, near]);
    expect(a.kmFromPrevious).toBeLessThan(1);
    expect(b.kmFromPrevious).toBeGreaterThan(5);
  });
  it("handles no stops", () => {
    expect(orderNearestNext(start, [])).toEqual([]);
  });
});

describe("kmBetweenStops", () => {
  it("skips the leg to the first stop", () => {
    expect(kmBetweenStops([{ kmFromPrevious: 5 }, { kmFromPrevious: 1 }, { kmFromPrevious: 2 }])).toBe(3);
    expect(kmBetweenStops([])).toBe(0);
  });
});

describe("googleMapsRouteUrl", () => {
  const pts = Array.from({ length: 12 }, (_, i) => ({ lat: 52 + i / 100, lng: 13 }));
  it("uses the last stop as destination and the rest as waypoints", () => {
    const url = new URL(googleMapsRouteUrl(pts.slice(0, 3), "walk")!);
    expect(url.searchParams.get("destination")).toBe("52.02,13");
    expect(url.searchParams.get("waypoints")).toBe("52,13|52.01,13");
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });
  it("keeps at most 9 waypoints", () => {
    const url = new URL(googleMapsRouteUrl(pts, "car")!);
    expect(url.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(url.searchParams.get("destination")).toBe("52.09,13");
  });
  it("leaves travel mode to Google for transit", () => {
    expect(new URL(googleMapsRouteUrl(pts.slice(0, 2), "transit")!).searchParams.has("travelmode")).toBe(false);
  });
  it("is null without stops", () => {
    expect(googleMapsRouteUrl([], "walk")).toBeNull();
  });
});
