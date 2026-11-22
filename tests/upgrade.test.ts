import { describe, expect, it } from "vitest";
import type { NominatimHit } from "@/lib/geocode";
import type { GeoCheck } from "@/lib/verify/geo";
import { classifyAny, decideUpgrade, findPlaceQuote, type UpgradeInput } from "@/lib/verify/upgrade";

describe("findPlaceQuote", () => {
  const page = "Dark is a German series. The police station scenes were filmed at the Akademie der Künste on Hanseatenweg in Berlin. Lunch nearby.";
  it("returns a short sentence that names the place", () => {
    expect(findPlaceQuote(page, "Akademie der Künste (Hanseatenweg)", "Berlin")).toMatch(/Akademie der Künste/);
  });
  it("ignores pages that only share generic words", () => {
    expect(findPlaceQuote("A school in Berlin was used.", "Reinfelder Schule", "Berlin")).toBeNull();
  });
  it("needs every distinctive word, not just one (Schloss Lanke is not Schloss Börnicke)", () => {
    expect(findPlaceQuote("The hotel is the Lanke Castle (Schloss Lanke) in Brandenburg.", "Schloss Börnicke", "Bernau bei Berlin")).toBeNull();
    expect(findPlaceQuote("shot at a driving academy in Zossen.", "Akademie der Künste (Hanseatenweg)", "Berlin")).toBeNull();
    expect(findPlaceQuote("Winden is more of a state of mind.", "Berlin State Library, Unter den Linden", "Berlin")).toBeNull();
    expect(findPlaceQuote("The factory was Schloß Börnicke near Bernau.", "Schloss Börnicke", "Bernau bei Berlin")).toMatch(/Börnicke/);
  });
  it("keeps quotes to 25 words", () => {
    const long = `${"word ".repeat(60)}Reinfelder Schule ${"word ".repeat(60)}.`;
    expect(findPlaceQuote(long, "Reinfelder Schule", "Berlin")!.split(" ").length).toBeLessThanOrEqual(25);
  });
});

const hit = (lat: number, lng: number, name = "Reinfelder-Schule"): NominatimHit => ({ lat: String(lat), lon: String(lng), display_name: "x", name });
const geo = (over: Partial<GeoCheck> = {}): GeoCheck => ({ kind: "poi", nameMatch: true, cityMatch: true, countryMatch: true, bbox: null, ...over });
const base: UpgradeInput = { name: "Reinfelder Schule", city: "Berlin", old: { lat: 52.5, lng: 13.4 }, trusted: true, quote: "filmed at X", hit: hit(52.5005, 13.4), geo: geo(), sceneNotes: ["Police station"] };

describe("decideUpgrade", () => {
  it("upgrades a matching landmark within 200 m", () => {
    const u = decideUpgrade(base);
    expect(u).toMatchObject({ upgrade: true, removeFromChallenge: false });
    expect(u.distanceM).toBeGreaterThan(50);
    expect(u.distanceM).toBeLessThan(60);
  });
  it("accepts a bigger move when the old pin lies inside the landmark's outline", () => {
    expect(decideUpgrade({ ...base, hit: hit(52.503, 13.4), geo: geo({ bbox: [52.49, 13.39, 52.51, 13.41] }) }).upgrade).toBe(true);
  });
  it("keeps the pin approximate when the landmark is far and the pin outside it", () => {
    const u = decideUpgrade({ ...base, hit: hit(52.51, 13.4) });
    expect(u.upgrade).toBe(false);
    expect(u.reasons.join()).toMatch(/1112 m from the stored pin/);
  });
  it("never upgrades without a trusted quote or a matching named landmark", () => {
    expect(decideUpgrade({ ...base, quote: null }).upgrade).toBe(false);
    expect(decideUpgrade({ ...base, trusted: false }).upgrade).toBe(false);
    expect(decideUpgrade({ ...base, geo: geo({ kind: "area" }) }).upgrade).toBe(false);
    expect(decideUpgrade({ ...base, geo: geo({ cityMatch: false }) }).upgrade).toBe(false);
    expect(decideUpgrade({ ...base, hit: null, geo: null }).upgrade).toBe(false);
    expect(decideUpgrade({ ...base, hit: hit(52.5005, 13.4, "Staatsbibliothek zu Berlin") }).upgrade).toBe(false);
  });
  it("accepts a geocoder name that matches an alias (the German name)", () => {
    const lib = { ...base, name: "Berlin State Library, Unter den Linden", hit: hit(52.5005, 13.4, "Staatsbibliothek zu Berlin"), geo: geo({ nameMatch: false }) };
    expect(decideUpgrade(lib).upgrade).toBe(false);
    expect(decideUpgrade({ ...lib, aliases: ["Staatsbibliothek zu Berlin", "Staatsbibliothek Unter den Linden"] }).upgrade).toBe(true);
  });
  it("flags private homes and studio interiors for removal from the challenge", () => {
    expect(decideUpgrade({ ...base, geo: geo({ kind: "residential" }) })).toMatchObject({ upgrade: false, removeFromChallenge: true });
    expect(decideUpgrade({ ...base, sceneNotes: ["Time-machine room (Studio 2)"] })).toMatchObject({ upgrade: false, removeFromChallenge: true });
  });
});

describe("classifyAny", () => {
  const library: NominatimHit = {
    lat: "52.5182229", lon: "13.3915166", display_name: "Staatsbibliothek zu Berlin, Unter den Linden 8", name: "Staatsbibliothek zu Berlin",
    category: "amenity", type: "library", addresstype: "amenity", address: { road: "Unter den Linden", city: "Berlin", country_code: "de" },
  };
  const name = "Berlin State Library, Unter den Linden";
  it("reads the German name as a different place without the alias, and as the landmark with it", () => {
    expect(classifyAny(library, [name], "Berlin").kind).toBe("unmatched");
    const g = classifyAny(library, [name, "Staatsbibliothek zu Berlin"], "Berlin");
    expect(g).toMatchObject({ kind: "poi", nameMatch: true, cityMatch: true });
    expect(decideUpgrade({ ...base, name, aliases: ["Staatsbibliothek zu Berlin"], old: { lat: 52.5182229, lng: 13.3915166 }, hit: library, geo: g }).upgrade).toBe(true);
  });
});
