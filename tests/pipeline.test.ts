import { describe, expect, it } from "vitest";
import { autoMerges, onlyDuplicateOf } from "@/lib/duplicates";
import { costOf, dailyBudget, estimateCost, priceFor } from "@/lib/pipeline/cost";
import { pickRequested, searchText, searchView, splitYear, workIdFor } from "@/lib/pipeline/plan";
import { domainGroups, parseResearch, researchPrompt } from "@/lib/pipeline/research";
import { TRUSTED_DOMAINS } from "@/lib/trusted-sources";
import { namesMatch } from "@/lib/verify/geo";
import { discoverQuery, toDiscovered, type WorkItem } from "@/lib/wikidata";

describe("cost", () => {
  it("prices known models, overrides from env, and assumes an expensive unknown model", () => {
    expect(priceFor("claude-sonnet-5-5", {})).toEqual({ inPerM: 2, outPerM: 10 });
    expect(priceFor("claude-sonnet-5-5", { AI_PRICE_INPUT_PER_MTOK: "1" })).toEqual({ inPerM: 1, outPerM: 10 });
    expect(priceFor("some-new-model", {})).toEqual({ inPerM: 10, outPerM: 50 });
  });
  it("costs a response from its usage, with cache and searches", () => {
    const p = { inPerM: 2, outPerM: 10 };
    expect(costOf({ input_tokens: 1_000_000, output_tokens: 100_000 }, p)).toBe(3);
    expect(costOf({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, server_tool_use: { web_search_requests: 3 } }, p)).toBeCloseTo(0.23);
  });
  it("reserves an upper bound before the call", () => {
    expect(estimateCost(40_000, 1000, { inPerM: 2, outPerM: 10 })).toBeCloseTo(0.03);
    expect(estimateCost(0, 0, { inPerM: 2, outPerM: 10 }, 2)).toBeCloseTo(0.1);
  });
  it("reads the daily budget; unset means no AI calls", () => {
    expect(dailyBudget({ DAILY_AI_BUDGET: "5" })).toBe(5);
    expect(dailyBudget({})).toBeNull();
    expect(dailyBudget({ DAILY_AI_BUDGET: "lots" })).toBeNull();
  });
});

describe("research", () => {
  it("keeps only trusted https pages with a name and a quote, once each", () => {
    const raw = JSON.stringify({ places: [
      { name: "Kaufhaus Görlitz", city: "Görlitz", url: "https://www.visit-goerlitz.com/film", quote: "The Grand Budapest Hotel was filmed in the Kaufhaus." },
      { name: "Kaufhaus Görlitz", city: "Görlitz", url: "https://www.visit-goerlitz.com/film", quote: "again" },
      { name: "Fan page", city: null, url: "https://fandom.com/x", quote: "filmed here" },
      { name: "No quote", city: null, url: "https://www.berlin.de/x", quote: "" },
      { name: "Plain http", city: null, url: "http://www.berlin.de/x", quote: "filmed" },
    ] });
    expect(parseResearch(raw)).toEqual([{ name: "Kaufhaus Görlitz", city: "Görlitz", url: "https://www.visit-goerlitz.com/film", quote: "The Grand Budapest Hotel was filmed in the Kaufhaus." }]);
    expect(parseResearch("not json")).toEqual([]);
    expect(parseResearch(`Here you go: {"places": [{"name": "Rotes Rathaus", "city": "Berlin", "url": "https://www.visitberlin.de/x", "quote": "filmed at the Rotes Rathaus"}]}`)).toHaveLength(1);
    expect(parseResearch(JSON.stringify({ places: "x" }))).toEqual([]);
  });
  it("splits the trusted domains into tool-sized groups and names the region", () => {
    const groups = domainGroups();
    expect(groups.flat()).toEqual([...TRUSTED_DOMAINS]);
    expect(Math.max(...groups.map((g) => g.length))).toBeLessThanOrEqual(60);
    expect(researchPrompt({ title: "Dark", type: "series", year: 2017, aliases: ["Dark"] })).toBe('Where in Germany was the series "Dark" (2017) filmed?');
  });
});

describe("plan", () => {
  const item = (qid: string, labels: string[], year: number | null, series = false): WorkItem => ({ qid, labels, film: !series, series, year });
  it("splits a trailing year", () => {
    expect(splitYear("Dark 2017")).toEqual({ title: "Dark", year: 2017 });
    expect(splitYear("Dark (2017)")).toEqual({ title: "Dark", year: 2017 });
    expect(splitYear("1917")).toEqual({ title: "1917", year: null });
  });
  it("picks the requested title, asks for the year when several fit", () => {
    const items = [item("Q1", ["Dark"], 2017, true), item("Q2", ["Dark"], 2005), item("Q3", ["Darkness"], 2010)];
    expect(pickRequested("dark 2017", items)).toEqual({ item: items[0] });
    expect("ambiguous" in pickRequested("Dark", items)).toBe(true);
    expect(pickRequested("Nothing like it", items)).toEqual({ none: true });
  });
  it("gives new works readable unique ids", () => {
    expect(workIdFor("The Queen's Gambit", 2020, "Q1", new Set())).toBe("the-queen-s-gambit");
    expect(workIdFor("Dark", 2017, "Q1", new Set(["dark"]))).toBe("dark-2017");
    expect(workIdFor("Dark", null, "Q99", new Set(["dark"]))).toBe("dark-q99");
  });
  it("shows a request as queued, searching, then its result once no job is open", () => {
    const req = { search_status: "queued" as const, found: 0, message: null, work_id: null };
    expect(searchView(req, 1, 0).status).toBe("queued");
    expect(searchView(req, 2, 1).status).toBe("searching");
    expect(searchView({ ...req, search_status: "found", found: 3 }, 1, 1)).toMatchObject({ status: "searching", done: false });
    const done = searchView({ ...req, search_status: "found", found: 3 }, 0, 0);
    expect(done).toMatchObject({ status: "found", found: 3, done: true });
    expect(searchText(done, "Dark")).toBe("Found 3 verified places for Dark.");
    expect(searchText(searchView({ ...req, search_status: "nothing" }, 0, 0), "Dark")).toMatch(/Nothing verified/);
  });
});

describe("automatic merges", () => {
  const p = (id: number, name: string, lat: number, lng: number, aliases: string[] = []) => ({ id, name, city: "Berlin", lat, lng, aliases });
  it("merges only the same named place within 30 m, keeping the lowest id", () => {
    const places = [
      p(5, "Staatsbibliothek zu Berlin", 52.5176, 13.3925),
      p(9, "Berlin State Library, Unter den Linden", 52.51761, 13.39252, ["Staatsbibliothek zu Berlin"]),
      p(7, "Café Einstein", 52.51762, 13.39253), // as close, but a different place
      p(12, "Staatsbibliothek zu Berlin", 52.53, 13.39), // same name, 1.4 km away
    ];
    expect(autoMerges(places, namesMatch)).toEqual([{ keep: 5, drop: [9] }]);
  });
  it("recognises a draft whose only problem is a published duplicate", () => {
    expect(onlyDuplicateOf(["published place within 30 m (#32, #45)"])).toEqual([32, 45]);
    expect(onlyDuplicateOf(["published place within 30 m (#32)", "domain not trusted"])).toBeNull();
    expect(onlyDuplicateOf(["domain not trusted"])).toBeNull();
  });
});

describe("discover", () => {
  it("pages films and series filmed in the region", () => {
    const q = discoverQuery(50, 100);
    expect(q).toContain("wd:Q183");
    expect(q).toContain("LIMIT 50 OFFSET 100");
    expect(() => discoverQuery(0, 0)).toThrow();
  });
  it("reads a row, skipping items without a name", () => {
    expect(toDiscovered({ work: { value: "http://www.wikidata.org/entity/Q123" }, label: { value: "Dark" }, year: { value: "2017" }, series: { value: "true" }, n: { value: "9" } }))
      .toEqual({ qid: "Q123", label: "Dark", year: 2017, type: "series", places: 9 });
    expect(toDiscovered({ work: { value: "http://www.wikidata.org/entity/Q1" } })).toBeNull();
  });
});
