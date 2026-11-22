import { describe, expect, it } from "vitest";
import { isTrustedSource } from "@/lib/trusted-sources";
import { extractText, quoteFound } from "@/lib/verify/text";
import { parseVerdict } from "@/lib/verify/ai";
import { classifyGeocode, namesMatch } from "@/lib/verify/geo";
import { decide, type Checks } from "@/lib/verify/decide";
import { isPrivateAddress } from "@/lib/verify/fetch-page";
import { combine, type LinkResult } from "@/lib/verify/run";

describe("isTrustedSource", () => {
  it("accepts listed domains and their subdomains", () => {
    expect(isTrustedSource("https://www.visitberlin.de/en/glienicke-bridge-bridge-spies")).toBe(true);
    expect(isTrustedSource("https://en.goethe.de/x")).toBe(true);
    expect(isTrustedSource("https://visit-goerlitz.com/A-Walk")).toBe(true);
    expect(isTrustedSource("https://www.theguardian.com/film/x")).toBe(true);
  });
  it("rejects lookalikes, blogs, marketplaces, wikis and bad URLs", () => {
    expect(isTrustedSource("https://visitberlin.de.evil.com/x")).toBe(false);
    expect(isTrustedSource("https://notvisitberlin.de/x")).toBe(false);
    expect(isTrustedSource("https://foodieexplorers.co.uk/x")).toBe(false);
    expect(isTrustedSource("https://giggster.com/guide/x")).toBe(false);
    expect(isTrustedSource("https://www.wikidata.org/wiki/Q1")).toBe(false);
    expect(isTrustedSource("ftp://visitberlin.de/x")).toBe(false);
    expect(isTrustedSource("not a url")).toBe(false);
  });
});

describe("extractText and quoteFound", () => {
  const html = `<html><head><style>.x{}</style><script>var a="Glienicke";</script></head>
    <body><nav>Menu</nav><p>Steven Spielberg filmed the spy&nbsp;exchange on the <b>Glienicke Bridge</b> &amp; more.</p></body></html>`;
  it("keeps visible text only and decodes entities", () => {
    const t = extractText(html);
    expect(t).toContain("Steven Spielberg filmed the spy exchange on the Glienicke Bridge & more.");
    expect(t).not.toContain("var a");
    expect(t).not.toContain(".x{}");
  });
  it("finds a quote despite case, spacing and curly quotes", () => {
    const t = extractText(html);
    expect(quoteFound("filmed the spy  exchange on the Glienicke bridge", t)).toBe(true);
    expect(quoteFound("Spielberg’s crew filmed", "Spielberg's crew filmed here")).toBe(true);
  });
  it("rejects quotes that aren't on the page, are too long or too short", () => {
    const t = extractText(html);
    expect(quoteFound("filmed the prisoner swap on the bridge", t)).toBe(false);
    expect(quoteFound(Array(30).fill("word").join(" "), Array(30).fill("word").join(" "))).toBe(false);
    expect(quoteFound("the", t)).toBe(false);
  });
});

describe("parseVerdict", () => {
  const ok = { filmed_here: true, story_setting_only: false, depicts: "The spy exchange", evidence_quote: "filmed on the bridge", confidence: "high" };
  it("accepts the expected JSON shape", () => {
    expect(parseVerdict(JSON.stringify(ok))).toEqual(ok);
    expect(parseVerdict(JSON.stringify({ ...ok, filmed_here: "unclear", depicts: null }))?.filmed_here).toBe("unclear");
  });
  it("rejects anything else", () => {
    expect(parseVerdict("not json")).toBeNull();
    expect(parseVerdict(JSON.stringify({ ...ok, confidence: "very high" }))).toBeNull();
    expect(parseVerdict(JSON.stringify({ ...ok, filmed_here: "yes" }))).toBeNull();
    expect(parseVerdict(JSON.stringify({ ...ok, evidence_quote: 5 }))).toBeNull();
  });
});

describe("namesMatch", () => {
  it("matches the same place despite accents, case, articles and extra words", () => {
    expect(namesMatch("Kaufhaus Görlitz", "Kaufhaus Gorlitz")).toBe(true);
    expect(namesMatch("Glienicke Bridge", "Glienicker Brücke")).toBe(false); // different language: no guess
    expect(namesMatch("Tempelhof Airport", "Flughafen Tempelhof")).toBe(true); // shared distinctive word
    expect(namesMatch("Rotes Rathaus", "Berliner Rathaus")).toBe(false);
  });
  it("ignores the place's own city and its adjective, for any city", () => {
    expect(namesMatch("Berliner Dom", "Berliner Philharmonie", "Berlin")).toBe(false);
    expect(namesMatch("Hamburger Michel", "Hamburger Kunsthalle", "Hamburg")).toBe(false);
    expect(namesMatch("Kunsthalle", "Hamburger Kunsthalle", "Hamburg")).toBe(true);
  });
});

describe("classifyGeocode", () => {
  const hit = (o: Record<string, unknown>) => ({ lat: "51.15", lon: "14.98", display_name: "x", ...o });
  it("treats a named landmark in the right city as a POI with its bounding box", () => {
    const g = classifyGeocode(hit({ category: "building", type: "retail", name: "Kaufhaus Görlitz", boundingbox: ["51.1527", "51.1533", "14.9866", "14.9874"], address: { city: "Görlitz", country_code: "de" } }), "Kaufhaus Görlitz", "Görlitz");
    expect(g).toMatchObject({ kind: "poi", nameMatch: true, cityMatch: true, countryMatch: true });
    expect(g.bbox).toEqual([51.1527, 14.9866, 51.1533, 14.9874]);
  });
  it("flags houses and residential buildings as possible private homes", () => {
    expect(classifyGeocode(hit({ category: "building", type: "house", address: { city: "Berlin", country_code: "de" } }), "X", "Berlin").kind).toBe("residential");
    expect(classifyGeocode(hit({ category: "place", type: "house", address: { city: "Berlin", country_code: "de" } }), "X", "Berlin").kind).toBe("residential");
    expect(classifyGeocode(hit({ category: "building", type: "apartments", name: "Wohnhaus", address: { city: "Berlin", country_code: "de" } }), "Wohnhaus", "Berlin").kind).toBe("residential");
  });
  it("treats roads, suburbs and cities as areas, and unnamed or unmatched hits as not a POI", () => {
    expect(classifyGeocode(hit({ category: "highway", type: "residential", name: "Untermarkt", address: { city: "Görlitz", country_code: "de" } }), "Untermarkt", "Görlitz").kind).toBe("area");
    expect(classifyGeocode(hit({ category: "boundary", type: "administrative", addresstype: "suburb", name: "Tempelhof" }), "Tempelhof Airport", "Berlin").kind).toBe("area");
    // A different named place must never lend its pin: that goes to review, not to "area".
    expect(classifyGeocode(hit({ category: "tourism", type: "attraction", name: "Something Else", address: { city: "Berlin", country_code: "de" } }), "Rotes Rathaus", "Berlin").kind).toBe("unmatched");
  });
  it("checks city and country", () => {
    const g = classifyGeocode(hit({ category: "historic", type: "monument", name: "Rathaus", address: { town: "Potsdam", country_code: "de" } }), "Rathaus", "Berlin");
    expect(g.cityMatch).toBe(false);
    expect(classifyGeocode(hit({ category: "historic", type: "monument", name: "Rathaus", address: { city: "Wien", country_code: "at" } }), "Rathaus", "Wien").countryMatch).toBe(false);
    expect(classifyGeocode(hit({ category: "historic", type: "monument", name: "Rathaus", address: { city: "Görlitz" } }), "Rathaus", "Görlitz").countryMatch).toBe(false);
  });
});

describe("decide", () => {
  const base: Checks = {
    fetched: true, verdict: { filmed_here: true, story_setting_only: false, depicts: "x", evidence_quote: "q", confidence: "high" },
    quoteFound: true, trusted: true, geocode: { kind: "poi", nameMatch: true, cityMatch: true, countryMatch: true, bbox: null },
    duplicateIds: [], existingQuality: "approx", geocodeFarFromSource: false,
  };
  it("publishes only when every check passes, at building precision for a POI", () => {
    expect(decide(base)).toEqual({ decision: "published", reasons: [], confidence: "building", coordQuality: "geocoded_poi" });
  });
  it("publishes an area match as approximate, without changing a source pin", () => {
    expect(decide({ ...base, geocode: { ...base.geocode!, kind: "area" } })).toMatchObject({ decision: "published", confidence: "area", coordQuality: "approx" });
    expect(decide({ ...base, existingQuality: "source" })).toMatchObject({ decision: "published", coordQuality: "source", confidence: "building" });
  });
  it("sends everything else to review with every reason listed", () => {
    expect(decide({ ...base, fetched: false }).reasons).toEqual(["source unreachable"]);
    const r = decide({
      ...base, trusted: false, quoteFound: false, duplicateIds: [32],
      verdict: { ...base.verdict!, confidence: "medium", story_setting_only: true },
      geocode: { ...base.geocode!, kind: "residential" },
    });
    expect(r.decision).toBe("needs_review");
    expect(r.reasons).toEqual([
      "story setting only", "AI confidence medium", "evidence quote not found on the page",
      "domain not trusted", "possible private home", "published place within 30 m (#32)",
    ]);
    expect(decide({ ...base, verdict: { ...base.verdict!, filmed_here: false } })).toMatchObject({ decision: "rejected" });
    expect(decide({ ...base, verdict: null }).reasons).toEqual(["AI answer missing or invalid"]);
    expect(decide({ ...base, verdict: null, aiError: "HTTP 529" }).reasons).toEqual(["AI call failed (HTTP 529)"]);
    expect(decide({ ...base, geocode: null }).reasons).toEqual(["no geocoder match"]);
    expect(decide({ ...base, geocode: { ...base.geocode!, cityMatch: false } }).reasons).toEqual(["city does not match"]);
    expect(decide({ ...base, geocodeFarFromSource: true }).reasons).toEqual(["geocoder result far from the stored pin"]);
    expect(decide({ ...base, geocode: { ...base.geocode!, kind: "unmatched" } }).reasons).toEqual(["geocoder found a different place"]);
    expect(decide({ ...base, verdict: { ...base.verdict!, filmed_here: "unclear" } }).reasons).toEqual(["AI unsure it was filmed here"]);
  });
});

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and unique-local addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["93.184.216.34", "2a00:1450:4001::1"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("combine", () => {
  const link = (title: string, decision: "published" | "needs_review" | "rejected", reasons: string[] = []): LinkResult =>
    ({ workId: title, title, quote: null, verdict: null, decision: { decision, reasons, confidence: null, coordQuality: null } });
  it("publishes a place only when every title link passes", () => {
    expect(combine([link("A", "published"), link("B", "published")]).decision).toBe("published");
    expect(combine([link("A", "published"), link("B", "needs_review", ["domain not trusted"])]))
      .toEqual({ decision: "needs_review", reasons: ["B: domain not trusted"] });
  });
  it("rejects only when every link is rejected, and never publishes an empty place", () => {
    expect(combine([link("A", "rejected", ["x"])]).decision).toBe("rejected");
    expect(combine([link("A", "rejected", ["x"]), link("B", "published")]).decision).toBe("needs_review");
    expect(combine([])).toEqual({ decision: "needs_review", reasons: ["no title links to check"] });
  });
});
