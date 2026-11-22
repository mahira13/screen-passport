import { describe, expect, it } from "vitest";
import { defaultCity, deriveCities, findCity, findCityByName, MIN_CITY_PLACES, nearestCity, startFromHint } from "@/lib/cities";

const row = (id: number, city: string | null, lat: number, lng: number, country_code: string | null = "DE") =>
  ({ id, city, lat, lng, country_code });

// Two rows for place 1 (filmed for two titles) count as one place.
const rows = [
  row(1, "Berlin", 52.5, 13.4), row(1, "Berlin", 52.5, 13.4), row(2, "Berlin", 52.52, 13.41), row(3, "berlin", 52.54, 13.42),
  row(4, "Berlin", 52.51, 13.39),
  row(10, "Görlitz", 51.15, 14.98), row(11, "Görlitz", 51.16, 14.99), row(12, "Görlitz", 51.155, 14.985),
  row(20, "Hamburg", 53.55, 9.99), row(21, "Hamburg", 53.56, 10.0),
  row(30, null, 50, 10),
];

describe("deriveCities", () => {
  const cities = deriveCities(rows);

  it("keeps cities with enough distinct published places, most places first", () => {
    expect(MIN_CITY_PLACES).toBe(3);
    expect(cities.map((c) => [c.id, c.name, c.places])).toEqual([["berlin", "Berlin", 4], ["goerlitz", "Görlitz", 3]]);
  });
  it("centres each city on its places and takes the time zone from the country", () => {
    expect(cities[1]).toMatchObject({ lat: 51.155, lng: 14.985, tz: "Europe/Berlin" });
  });
  it("is empty without data", () => {
    expect(deriveCities([])).toEqual([]);
    expect(defaultCity([])).toBeNull();
  });
});

describe("finding a city", () => {
  const cities = deriveCities(rows);
  it("by id and by name, ignoring accents and German spellings", () => {
    expect(findCity(cities, "goerlitz")?.name).toBe("Görlitz");
    expect(findCity(cities, "nope")).toBeUndefined();
    expect(findCity(cities, null)).toBeUndefined();
    expect(findCityByName(cities, "GÖRLITZ")?.id).toBe("goerlitz");
    expect(findCityByName(cities, "Goerlitz")?.id).toBe("goerlitz");
  });
  it("default is the city with the most places", () => {
    expect(defaultCity(cities)?.id).toBe("berlin");
  });
  it("nearest city to a point", () => {
    expect(nearestCity(cities, { lat: 51.05, lng: 13.74 })?.id).toBe("goerlitz"); // Dresden
    expect(nearestCity([], { lat: 51, lng: 13 })).toBeNull();
  });
});

describe("startFromHint (IP location, a hint only)", () => {
  const cities = deriveCities(rows);
  it("in Germany: the nearest city with published places", () => {
    expect(startFromHint(cities, { country: "DE", lat: "51.05", lng: "13.74" })).toEqual({ city: cities[1], source: "ip" });
  });
  it("outside Germany, or without usable headers: the city with the most places", () => {
    expect(startFromHint(cities, { country: "FR", lat: "48.85", lng: "2.35" })).toEqual({ city: cities[0], source: "default" });
    expect(startFromHint(cities, { country: "DE", lat: "x", lng: null })).toEqual({ city: cities[0], source: "default" });
    expect(startFromHint(cities, {})).toEqual({ city: cities[0], source: "default" });
  });
  it("no cities at all", () => {
    expect(startFromHint([], { country: "DE", lat: "51", lng: "13" })).toEqual({ city: null, source: "default" });
  });
});
