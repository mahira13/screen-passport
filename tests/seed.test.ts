// Checks the real seed CSVs, so bad data fails `npm test` before import.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { toCollection, toLocation, toWork, validateSeed } from "../scripts/seed-rows";

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
  it("leaves rows without coordinates empty with no coord_quality", () => {
    const pending = locations.filter((l) => l.lat === null);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((l) => l.lng === null && l.coord_quality === null)).toBe(true);
  });
});

describe("validateSeed", () => {
  it("flags missing sources and unknown works", () => {
    const bad = { ...locations[0], source_url: "", work_id: "nope" };
    const problems = validateSeed(works, [bad], [{ ...collections[0], work_ids: ["ghost"] }]);
    expect(problems.some((p) => p.includes("missing source_url"))).toBe(true);
    expect(problems.some((p) => p.includes("unknown work nope"))).toBe(true);
    expect(problems.some((p) => p.includes("unknown work ghost"))).toBe(true);
  });
});
