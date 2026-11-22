import { describe, expect, it } from "vitest";
import { collectionProgress, startedCollections, visitProgress } from "@/lib/collections";
import type { Collection } from "@/lib/types";

const coldWar: Collection = {
  id: "cold-war-berlin", name: "Cold War Berlin", city: "Berlin",
  work_ids: ["bridge-of-spies", "bourne-supremacy", "atomic-blonde", "unknown-2011"], description: null,
};
const twenties: Collection = {
  id: "1920s-berlin", name: "Golden Twenties", city: "Berlin", work_ids: ["babylon-berlin"], description: null,
};
const goerliwood: Collection = {
  id: "goerliwood", name: "Görliwood", city: "Görlitz",
  work_ids: ["grand-budapest", "inglourious-basterds", "the-reader", "monuments-men"], description: null,
};

describe("collectionProgress", () => {
  it("counts watched works in the collection", () => {
    const p = collectionProgress(coldWar, ["bridge-of-spies", "atomic-blonde", "dark"]);
    expect(p).toMatchObject({ done: 2, total: 4, complete: false, label: "Cold War Berlin 2/4" });
  });
  it("ignores duplicates in both lists", () => {
    const c = { ...coldWar, work_ids: [...coldWar.work_ids, "atomic-blonde"] };
    expect(collectionProgress(c, ["atomic-blonde", "atomic-blonde"]).label).toBe("Cold War Berlin 1/4");
  });
  it("is complete when every work is watched", () => {
    expect(collectionProgress(twenties, ["babylon-berlin"]).complete).toBe(true);
  });
  it("an empty collection is never complete", () => {
    expect(collectionProgress({ ...twenties, work_ids: [] }, []).complete).toBe(false);
  });
});

describe("startedCollections", () => {
  it("drops untouched collections and sorts by share done", () => {
    const res = startedCollections([coldWar, twenties, goerliwood], ["bridge-of-spies", "babylon-berlin"]);
    expect(res.map((p) => p.label)).toEqual(["Golden Twenties 1/1", "Cold War Berlin 1/4"]);
  });
});

describe("visitProgress", () => {
  it("counts visited places of the collection", () => {
    expect(visitProgress([1, 2, 3], [2, 9])).toEqual({ done: 1, total: 3, complete: false });
  });
  it("is complete only when every place is visited", () => {
    expect(visitProgress([1, 2], [2, 1]).complete).toBe(true);
    expect(visitProgress([], [1]).complete).toBe(false);
  });
  it("ignores duplicate place ids", () => {
    expect(visitProgress([1, 1, 2], [1, 1])).toEqual({ done: 1, total: 2, complete: false });
  });
});
