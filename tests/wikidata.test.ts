import { describe, expect, it } from "vitest";
import { normaliseTitle } from "@/lib/match";
import { draftRow, filmingLocationsQuery, findExisting, pickWorkItem, toCandidate, type WorkItem } from "@/lib/wikidata";

const v = (value: string) => ({ value });
const row = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, v(x)]));

describe("toCandidate", () => {
  it("reads name, city, point and building class", () => {
    const c = toCandidate(row({
      loc: "http://www.wikidata.org/entity/Q694708", label: "Glienicker Brücke", city: "Potsdam",
      point: "Point(13.0906 52.4133)", building: "true", open: "false", broad: "false", home: "false", refs: "",
    }));
    expect(c).toMatchObject({ qid: "Q694708", name: "Glienicker Brücke", city: "Potsdam", lat: 52.4133, lng: 13.0906, confidence: "building", skip: null });
  });
  it("treats streets and squares as areas", () => {
    expect(toCandidate(row({ loc: "x/Q1", label: "Pariser Platz", building: "true", open: "true" })).confidence).toBe("area");
  });
  it("skips towns, private homes and film studios", () => {
    expect(toCandidate(row({ loc: "x/Q64", label: "Berlin", broad: "true" })).skip).toMatch(/town/);
    expect(toCandidate(row({ loc: "x/Q2", label: "Haus Müller", home: "true", building: "true" })).skip).toMatch(/private home/);
    expect(toCandidate(row({ loc: "x/Q705676", label: "Studio Babelsberg" })).skip).toMatch(/studio/);
  });
  it("keeps only http reference URLs", () => {
    expect(toCandidate(row({ loc: "x/Q3", label: "A", refs: "https://a.org/x ftp://b" })).refs).toEqual(["https://a.org/x"]);
  });
});

describe("findExisting", () => {
  const ours = [{ id: 44, name: "Glienicke Bridge", city: "Potsdam", lat: 52.4136, lng: 13.0901 }];
  const base = { qid: "Q1", city: "Berlin", confidence: "building" as const, refs: [], skip: null };
  it("finds the same place under its German name nearby", () => {
    expect(findExisting({ ...base, name: "Glienicker Brücke", lat: 52.4133, lng: 13.0906 }, ours)?.place.id).toBe(44);
  });
  it("finds the same name in the same city without coordinates", () => {
    expect(findExisting({ ...base, name: "Glienicke Bridge", city: "Potsdam", lat: null, lng: null }, ours)?.place.id).toBe(44);
  });
  it("lets a different place through", () => {
    expect(findExisting({ ...base, name: "Neue Nationalgalerie", lat: 52.507, lng: 13.367 }, ours)).toBeNull();
  });
});

describe("draftRow", () => {
  const c = { qid: "Q1097", name: "Berlin Hauptbahnhof", city: "Berlin", lat: 52.525, lng: 13.369, confidence: "building" as const, refs: [], skip: null };
  it("is always a draft, with no scene and an unchecked point", () => {
    expect(draftRow(c, "unknown-2011")).toMatchObject({
      verification_status: "draft", status: "unverified", scene_note: null, coord_quality: "approx",
      location_confidence: "building", source_url: "https://www.wikidata.org/wiki/Q1097", work_id: "unknown-2011",
    });
  });
  it("prefers a cited reference that isn't a wiki", () => {
    const r = draftRow({ ...c, refs: ["https://en.wikipedia.org/wiki/X", "https://www.visitberlin.de/en/x"] }, "x");
    expect(r).toMatchObject({ source_url: "https://www.visitberlin.de/en/x", source_name: "visitberlin.de" });
  });
});

describe("pickWorkItem", () => {
  const items: WorkItem[] = [
    { qid: "Q159063", labels: ["The Reader", "Der Vorleser"], film: true, series: false, year: 2008 },
    { qid: "Q425602", labels: ["The Reader", "Die Vorleserin"], film: true, series: false, year: 1988 },
    { qid: "Q9", labels: ["The Reader"], film: false, series: false, year: 2008 },
  ];
  const work = { title: "The Reader", aliases: ["Der Vorleser"], type: "film" as const, year: null };
  it("refuses to guess between two films of the same name", () => {
    expect(pickWorkItem(work, items, normaliseTitle)).toEqual({ ambiguous: items.slice(0, 2) });
  });
  it("uses the year when we know it", () => {
    expect(pickWorkItem({ ...work, year: 2008 }, items, normaliseTitle)).toEqual({ qid: "Q159063" });
  });
});

it("rejects anything that isn't an item id in the query", () => {
  expect(() => filmingLocationsQuery("Q1 } DROP")).toThrow();
});
