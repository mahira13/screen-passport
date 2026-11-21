import { describe, expect, it } from "vitest";
import { laylaPrompt, mainCity } from "@/lib/layla";
import { directionsUrl } from "@/lib/links";

const places = [
  { name: "Körnerpark", city: "Berlin", distanceKm: 6 },
  { name: "Rotes Rathaus", city: "Berlin", distanceKm: 0.3 },
  { name: "Sanssouci Palace", city: "Potsdam", distanceKm: 25 },
  { name: "Alexanderplatz", city: "Berlin", distanceKm: 0.6 },
];

describe("laylaPrompt", () => {
  it("starts with the chosen place, then same-city places closest first", () => {
    expect(laylaPrompt("Babylon Berlin", { name: "Körnerpark", city: "Berlin" }, places)).toBe(
      "Plan a day in Berlin visiting Körnerpark, Rotes Rathaus and Alexanderplatz where Babylon Berlin was filmed.",
    );
  });
  it("handles a single place and other cities", () => {
    expect(laylaPrompt("Queen of Tears", { name: "Sanssouci Palace", city: "Potsdam" }, places)).toBe(
      "Plan a day in Potsdam visiting Sanssouci Palace where Queen of Tears was filmed.",
    );
  });
  it("caps at five places", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, city: "Berlin", distanceKm: i }));
    expect(laylaPrompt("X", { name: "P8", city: "Berlin" }, many)).toBe(
      "Plan a day in Berlin visiting P8, P0, P1, P2 and P3 where X was filmed.",
    );
  });
  it("uses the first city of 'Berlin/Potsdam' and copes with no city", () => {
    expect(mainCity("Berlin/Potsdam")).toBe("Berlin");
    expect(laylaPrompt("Bridge of Spies", { name: "Glienicke Bridge", city: "Berlin/Potsdam" }, [])).toBe(
      "Plan a day in Berlin visiting Glienicke Bridge where Bridge of Spies was filmed.",
    );
    expect(laylaPrompt("X", { name: "Y", city: null }, [])).toBe("Plan a day visiting Y where X was filmed.");
  });
});

describe("directionsUrl", () => {
  it("builds a Google Maps directions link", () => {
    expect(directionsUrl({ lat: 52.5186, lng: 13.4081 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=52.5186,13.4081",
    );
  });
});
