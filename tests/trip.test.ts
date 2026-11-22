import { describe, expect, it } from "vitest";
import type { LiveLocation } from "@/lib/nearby";
import {
  codePlan, formatTripDate, isValidTimeZone, nearestCity, parseFrom, parseStartsAt, parseWorkIds, selectTripStops,
  shareText, tripLaylaPrompt, tzLabel, validateFirstName, validateMeetingPoint, validatePlan, zonedTimeToUtc,
} from "@/lib/trip";
import type { Work } from "@/lib/types";

const works: Work[] = [
  { id: "dark", title: "Dark", type: "series", aliases: [], year: null },
  { id: "bb", title: "Babylon Berlin", type: "series", aliases: [], year: null },
];
const loc = (id: number, work_id: string, lat: number, lng: number, city = "Berlin"): LiveLocation => ({
  id, work_id, name: `Place ${id}`, city, lat, lng, coord_quality: "source", scene_note: `Scene ${id}`,
});
const berlin = parseFrom("berlin")!;
const locations = [
  loc(1, "bb", 52.521, 13.41),
  loc(2, "bb", 52.5, 13.3),
  loc(3, "dark", 52.4, 13.05, "Potsdam"), // ~25 km
  loc(4, "bb", 51.05, 13.74, "Dresden"), // ~165 km
  loc(5, "other", 52.52, 13.405),
  ...Array.from({ length: 10 }, (_, i) => loc(10 + i, "bb", 52.52 + i / 1000, 13.42)),
];

describe("parseFrom", () => {
  it("takes a city id or rounded lat,lng", () => {
    expect(berlin).toMatchObject({ label: "Berlin", param: "berlin", tz: "Europe/Berlin" });
    expect(parseFrom("52.52049,13.40499")).toMatchObject({ lat: 52.52, lng: 13.405, param: "52.52,13.405", tz: null });
  });
  it("rejects anything else", () => {
    expect(parseFrom("atlantis")).toBeNull();
    expect(parseFrom("1,2,3")).toBeNull();
    expect(parseFrom("95,10")).toBeNull();
    expect(parseFrom(null)).toBeNull();
  });
});

describe("parseWorkIds", () => {
  it("dedupes and drops junk", () => {
    expect(parseWorkIds("dark, bb,dark,<x>,")).toEqual(["dark", "bb"]);
    expect(parseWorkIds(Array.from({ length: 20 }, (_, i) => `w${i}`).join(","))).toHaveLength(10);
  });
});

describe("selectTripStops", () => {
  it("keeps only chosen works within the mode's radius", () => {
    const walk = selectTripStops(locations, works, ["dark"], berlin, "walk", "full");
    expect(walk.map((s) => s.id)).toEqual([3]);
    expect(selectTripStops(locations, works, ["bb"], berlin, "car", "full").some((s) => s.id === 4)).toBe(false);
    expect(selectTripStops([loc(4, "bb", 51.05, 13.74)], works, ["bb"], berlin, "car", "full")).toHaveLength(0);
  });
  it("visits a place shared by two chosen titles once", () => {
    const shared = [loc(1, "bb", 52.521, 13.41), loc(1, "dark", 52.521, 13.41), loc(2, "bb", 52.5, 13.3)];
    expect(selectTripStops(shared, works, ["bb", "dark"], berlin, "car", "full").map((s) => s.id)).toEqual([1, 2]);
  });
  it("orders nearest-next and caps by length", () => {
    const half = selectTripStops(locations, works, ["bb", "dark"], berlin, "car", "half");
    expect(half).toHaveLength(5);
    expect(half[0].id).toBe(1);
    expect(selectTripStops(locations, works, ["bb", "dark"], berlin, "car", "full")).toHaveLength(8);
  });
});

describe("nearestCity", () => {
  it("names the city of the closest place of the chosen works", () => {
    expect(nearestCity(locations, ["dark"], berlin)).toBe("Potsdam");
    expect(nearestCity(locations, ["nope"], berlin)).toBeNull();
  });
});

describe("validatePlan", () => {
  const stops = selectTripStops(locations.slice(0, 3), works, ["bb", "dark"], berlin, "car", "full");
  const good = {
    title: "Babylon Berlin and Dark",
    intro: "A day out.",
    stops: stops.map((s) => ({ location_id: s.id, time: "10:00", travel_from_previous: "10 min walk", why_fans_love_it: "Iconic." })),
    tips: ["Bring water", 3],
  };
  it("accepts a plan that lists every stop in order", () => {
    const plan = validatePlan(good, stops)!;
    expect(plan.source).toBe("claude");
    expect(plan.stops.map((s) => s.location_id)).toEqual(stops.map((s) => s.id));
    expect(plan.tips).toEqual(["Bring water"]);
  });
  it("rejects invented, missing, reordered or duplicate IDs", () => {
    const withIds = (ids: number[]) => ({ ...good, stops: ids.map((id) => ({ ...good.stops[0], location_id: id })) });
    expect(validatePlan(withIds([stops[0].id, stops[1].id, 999]), stops)).toBeNull();
    expect(validatePlan(withIds([stops[0].id, stops[1].id]), stops)).toBeNull();
    expect(validatePlan(withIds([stops[1].id, stops[0].id, stops[2].id]), stops)).toBeNull();
    expect(validatePlan(withIds([stops[0].id, stops[0].id, stops[2].id]), stops)).toBeNull();
    expect(validatePlan({ ...good, stops: good.stops.map((s) => ({ ...s, location_id: String(s.location_id) })) }, stops)).toBeNull();
  });
  it("rejects links and offensive words anywhere in the text", () => {
    expect(validatePlan({ ...good, tips: ["More at spam.com"] }, stops)).toBeNull();
    expect(validatePlan({ ...good, intro: "A shit day." }, stops)).toBeNull();
  });
  it("rejects non-objects and missing titles", () => {
    expect(validatePlan("nope", stops)).toBeNull();
    expect(validatePlan({ ...good, title: " " }, stops)).toBeNull();
  });
});

describe("codePlan", () => {
  it("builds a plan from code only", () => {
    const stops = selectTripStops(locations.slice(0, 3), works, ["bb", "dark"], berlin, "walk", "full");
    const plan = codePlan(stops, berlin, "walk");
    expect(plan).toMatchObject({ source: "code", title: "Babylon Berlin and 1 more walk from Berlin", intro: null, tips: [] });
    expect(plan.stops[0].travel_from_previous).toMatch(/^about .* km from the start$/);
    expect(plan.stops[1].travel_from_previous).toMatch(/from the last stop$/);
    expect(plan.stops.every((s) => s.why_fans_love_it === null && s.time === null)).toBe(true);
  });
});

describe("validateFirstName", () => {
  it("accepts first names", () => {
    expect(validateFirstName("  Zoë ")).toBe("Zoë");
    expect(validateFirstName("Anne-Marie")).toBe("Anne-Marie");
    expect(validateFirstName("O’Neil")).toBe("O’Neil");
  });
  it("rejects emails, numbers, empty and long input", () => {
    expect(validateFirstName("a@b.de")).toBeNull();
    expect(validateFirstName("0151 1234")).toBeNull();
    expect(validateFirstName("")).toBeNull();
    expect(validateFirstName("x".repeat(31))).toBeNull();
    expect(validateFirstName(42)).toBeNull();
    expect(validateFirstName("Fotze")).toBeNull();
  });
});

describe("validateMeetingPoint", () => {
  it("allows empty, normal text; refuses links, slurs and long text", () => {
    expect(validateMeetingPoint(undefined)).toBe("");
    expect(validateMeetingPoint("  ")).toBe("");
    expect(validateMeetingPoint(" By the  World Clock ")).toBe("By the World Clock");
    expect(validateMeetingPoint("www.x.de")).toBeNull();
    expect(validateMeetingPoint("fuck")).toBeNull();
    expect(validateMeetingPoint("x".repeat(201))).toBeNull();
    expect(validateMeetingPoint(5)).toBeNull();
  });
});

describe("time zones", () => {
  it("checks and labels zones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(tzLabel("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });
  it("turns wall-clock time into the right instant, also across DST", () => {
    expect(zonedTimeToUtc("2026-11-28T10:00", "Europe/Berlin")!.toISOString()).toBe("2026-11-28T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01T10:00", "Europe/Berlin")!.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-28T10:00", "Europe/London")!.toISOString()).toBe("2026-11-28T10:00:00.000Z");
    expect(zonedTimeToUtc("2027-03-28T03:30", "Europe/Berlin")!.toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(zonedTimeToUtc("28.11.2026 10:00", "Europe/Berlin")).toBeNull();
  });
  it("shows times with the zone's city", () => {
    expect(formatTripDate("2026-11-28T10:00:00Z", "Europe/London")).toBe("Sat 28 Nov, 10:00 London time");
    expect(formatTripDate("2026-11-28T10:00:00Z", "Europe/Berlin")).toBe("Sat 28 Nov, 11:00 Berlin time");
  });
});

describe("parseStartsAt", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  it("accepts the next year, refuses the past and far future", () => {
    expect(parseStartsAt("2026-11-28T10:00", "Europe/Berlin", now)!.toISOString()).toBe("2026-11-28T09:00:00.000Z");
    expect(parseStartsAt("2026-11-20T09:00", "Europe/Berlin", now)).toBeNull();
    expect(parseStartsAt("2028-01-01T09:00", "Europe/Berlin", now)).toBeNull();
    expect(parseStartsAt("soon", "Europe/Berlin", now)).toBeNull();
  });
});

describe("share and Layla text", () => {
  it("uses the Berlin date", () => {
    expect(shareText("Dark walk", "2026-11-28T09:00:00Z", "Europe/Berlin", "https://x.de/trip/abc")).toBe(
      "Join me on Dark walk on Sat 28 Nov: https://x.de/trip/abc",
    );
    expect(
      tripLaylaPrompt("2026-11-28T09:00:00Z", "Europe/Berlin", [
        { name: "A", city: "Berlin", title: "Dark" },
        { name: "B", city: "Berlin/Potsdam", title: "Dark" },
      ]),
    ).toBe("Plan travel and a place to stay for Sat 28 Nov in Berlin. I'm visiting A and B where Dark was filmed.");
  });
});
