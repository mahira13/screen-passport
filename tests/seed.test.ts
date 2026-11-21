// Checks the real seed CSVs, so bad data fails `npm test` before import.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { keepReviewedFields, toCollection, toLocation, toWork, validateSeed } from "../scripts/seed-rows";

const read = (f: string): Record<string, string>[] =>
  parse(readFileSync(join(__dirname, "..", "data", "seed", f), "utf8"), { columns: true, trim: true, bom: true });

const works = read("titles.csv").map(toWork);
const locations = read("locations.csv").map(toLocation);
const collections = read("collections.csv").map(toCollection);

describe("seed data", () => {
  it("has no problems", () => {
    expect(validateSeed(works, locations, collections)).toEqual([]);
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
