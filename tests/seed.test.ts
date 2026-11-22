// Checks the real seed CSVs, so bad data fails `npm test` before import.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { type DbLocation, keepReviewedFields, mergeWork, planLocationRow, toCollection, toLocation, toLocationWork, toWork, validateSeed } from "../scripts/seed-rows";

const read = (f: string): Record<string, string>[] =>
  parse(readFileSync(join(__dirname, "..", "data", "seed", f), "utf8"), { columns: true, trim: true, bom: true });

const works = read("titles.csv").map(toWork);
const locations = read("locations.csv").map(toLocation);
const collections = read("collections.csv").map(toCollection);
const links = read("location_works.csv").map(toLocationWork);

describe("seed data", () => {
  it("has no problems", () => {
    expect(validateSeed(works, locations, collections, links)).toEqual([]);
  });
  it("splits pipe-separated aliases and work_ids", () => {
    expect(works.find((w) => w.id === "queens-gambit")?.aliases).toEqual(["Das Damengambit", "Queen's Gambit"]);
    expect(collections.find((c) => c.id === "cold-war-berlin")?.work_ids).toHaveLength(4);
  });
  it("imports every location as unverified", () => {
    expect(locations.every((l) => l.status === "unverified")).toBe(true);
  });
  it("keeps coord_quality null for rows without coordinates", () => {
    const pending = locations.filter((l) => l.lat === null);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((l) => l.lng === null && l.coord_quality === null && l.geocode_query)).toBe(true);
  });
  it("uses no Wikipedia or fan-wiki sources", () => {
    expect(locations.filter((l) => /wikipedia|fandom|wiki\./i.test(l.source_url)).map((l) => l.id)).toEqual([]);
  });
});

describe("validateSeed", () => {
  it("flags missing sources, unknown works and bad coordinates", () => {
    const bad = { ...locations[0], source_url: "", work_id: "nope", lat: 52, lng: null, coord_quality: null };
    const problems = validateSeed(works, [bad], [{ ...collections[0], work_ids: ["ghost"] }]);
    for (const p of ["missing source_url", "unknown work nope", "unknown work ghost", "both be set"]) {
      expect(problems.some((x) => x.includes(p)), p).toBe(true);
    }
  });
  it("flags an unknown coord_quality such as the old 'geocode'", () => {
    const bad = { ...locations[0], lat: 52, lng: 13, coord_quality: "geocode" as never };
    expect(validateSeed(works, [bad], [])).toContainEqual(expect.stringContaining('bad coord_quality "geocode"'));
  });
});

describe("keepReviewedFields", () => {
  const csv = { ...locations[0], lat: null, lng: null, coord_quality: null, status: "unverified" as const };
  it("uses the CSV row for new locations", () => {
    expect(keepReviewedFields(csv, undefined)).toEqual(csv);
  });
  it("keeps status and coordinates set in the database", () => {
    const db = { id: csv.id, lat: 52.5, lng: 13.4, coord_quality: "verified" as const, status: "live" as const };
    expect(keepReviewedFields(csv, db)).toMatchObject({ lat: 52.5, lng: 13.4, coord_quality: "verified", status: "live" });
  });
  it("takes CSV coordinates when the database has none", () => {
    const withCoords = { ...csv, lat: 51, lng: 14, coord_quality: "source" as const };
    const db = { id: csv.id, lat: null, lng: null, coord_quality: null, status: "unverified" as const };
    expect(keepReviewedFields(withCoords, db)).toMatchObject({ lat: 51, lng: 14, coord_quality: "source" });
  });
});

describe("seed format v2", () => {
  const csv = locations.find((l) => l.id === 32)!;
  const db: DbLocation = {
    id: 32, lat: 52.5219, lng: 13.4132, coord_quality: "verified", status: "live", verification_status: "published",
    merged_into: null, country: "Germany", country_code: "DE", location_confidence: "exact", public_access: "public",
    is_filming_location: true,
  };

  it("records the approved merges and the title links they moved", () => {
    expect(locations.filter((l) => l.merged_into).map((l) => [l.id, l.merged_into])).toEqual(
      [[33, 25], [55, 32], [56, 22], [58, 45], [63, 32], [68, 60], [162, 179]]);
    expect(links.find((k) => k.location_id === 32 && k.work_id === "bourne-supremacy")?.scene_note).toMatch(/World Clock/);
  });

  it("never publishes: new rows arrive as draft with defaults, merged ones as rejected", () => {
    const fresh = planLocationRow({ ...csv, id: 999 }, undefined)!;
    expect(fresh).toMatchObject({ verification_status: "draft", status: "unverified", country_code: "DE", public_access: "unknown", is_filming_location: true });
    const merged = planLocationRow(locations.find((l) => l.id === 55)!, undefined)!;
    expect(merged).toMatchObject({ verification_status: "rejected", merged_into: 32 });
  });

  it("keeps verification, coordinates and catalogue fields from the database", () => {
    const row = planLocationRow({ ...csv, lat: 1, lng: 2, coord_quality: "approx" }, db)!;
    expect(row).toMatchObject({ verification_status: "published", status: "live", lat: 52.5219, coord_quality: "verified", location_confidence: "exact", public_access: "public" });
    expect(planLocationRow({ ...csv, public_access: "exterior_only" }, db)!.public_access).toBe("exterior_only");
  });

  it("merges place aliases from the CSV and the database", () => {
    const lib = locations.find((l) => l.id === 8)!;
    expect(lib.aliases).toEqual(["Staatsbibliothek zu Berlin", "Staatsbibliothek Unter den Linden"]);
    expect(planLocationRow(lib, { ...db, id: 8, aliases: ["Staatsbibliothek zu Berlin", "Stabi"] })!.aliases)
      .toEqual(["Staatsbibliothek zu Berlin", "Staatsbibliothek Unter den Linden", "Stabi"]);
    expect(planLocationRow({ ...csv, aliases: [] }, undefined)!.aliases).toEqual([]);
  });

  it("leaves places merged away in the database alone", () => {
    expect(planLocationRow(csv, { ...db, merged_into: 25 })).toBeNull();
  });

  it("gives every planned row the same keys, so one upsert can't null a column", () => {
    const keys = (o: object) => Object.keys(o).sort().join();
    expect(keys(planLocationRow(csv, db)!)).toBe(keys(planLocationRow({ ...csv, id: 999 }, undefined)!));
  });

  it("keeps a year and aliases filled in the database (e.g. from TMDB)", () => {
    const w = works.find((x) => x.id === "queens-gambit")!;
    expect(mergeWork(w, { year: 2020, aliases: ["das damengambit", "Gambito de dama"] })).toMatchObject({
      year: 2020, aliases: ["Das Damengambit", "Queen's Gambit", "Gambito de dama"] });
    expect(mergeWork({ ...w, year: 2021 }, { year: 2020, aliases: [] }).year).toBe(2021);
  });

  it("rejects live rows, bad enums, Wikidata sources and broken links", () => {
    const bad = { ...csv, status: "live" as const, public_access: "open" as never, source_url: "https://www.wikidata.org/wiki/Q1" };
    const badLink = { location_id: 32, work_id: "dark", scene_note: null, depicts: null, evidence_url: null };
    const problems = validateSeed(works, [bad], [], [badLink, { ...badLink, location_id: 4040, evidence_url: "https://x.org" }]);
    for (const p of ["can't be live", 'bad public_access "open"', "untrusted source", "missing evidence_url", "4040/dark: unknown location"]) {
      expect(problems.some((x) => x.includes(p)), p).toBe(true);
    }
  });
});
