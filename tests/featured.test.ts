import { describe, expect, it } from "vitest";
import { buildCollections, slugify, type CollectionModel, type CollectionPlace } from "@/lib/collections-model";
import { featuredPicks, pinned, scoreCollections } from "@/lib/featured";
import type { LiveLocation } from "@/lib/nearby";
import type { Work } from "@/lib/types";

const BERLIN = { lat: 52.52, lng: 13.405 };
const at = (id: number, lat: number, lng: number, checkIn = false, photo = false): CollectionPlace =>
  ({ id, name: `P${id}`, city: null, lat, lng, checkIn, photo, thumb: null, image: null, titles: [] });
const col = (key: string, places: CollectionPlace[], pinRank: number | null = null): CollectionModel => ({
  key, kind: key.split(":")[0] as CollectionModel["kind"], slug: key.split(":")[1], name: key, description: null, href: "/",
  city: null, works: [], places, cover: null, pinRank,
});
const near = (id: number, o = {}) => ({ ...at(id, 52.52 + id / 1000, 13.405), ...o });
const far = (id: number, o = {}) => ({ ...at(id, 51.15, 14.99), ...o }); // Görlitz, ~190 km

describe("scoreCollections", () => {
  const berlin = col("curated:berlin", [near(1), near(2), near(3)]);
  const goerlitz = col("curated:goerlitz", [far(4, { checkIn: true }), far(5, { checkIn: true }), far(6, { checkIn: true, photo: true })]);
  const tiny = col("title:tiny", [near(7), near(8)]);

  it("needs at least 3 places", () => {
    expect(scoreCollections([berlin, tiny], { from: null, radiusKm: null }).map((s) => s.c.key)).toEqual(["curated:berlin"]);
  });
  it("with a location, nearby counts most (×3)", () => {
    const s = scoreCollections([goerlitz, berlin], { from: BERLIN, radiusKm: 25 });
    expect(s.map((x) => x.c.key)).toEqual(["curated:berlin", "curated:goerlitz"]);
    expect(s[0]).toMatchObject({ nearby: 1, score: 3 });
    expect(s[1].score).toBeCloseTo(2 + 1 / 3); // playable 1 ×2, visual 1/3
  });
  it("on Anywhere, nearby means within 50 km", () => {
    const s = scoreCollections([goerlitz, berlin], { from: BERLIN, radiusKm: null });
    expect(s.find((x) => x.c.key === "curated:goerlitz")!.nearby).toBe(0);
  });
  it("without a location ranks by playable + visual + size", () => {
    const s = scoreCollections([berlin, goerlitz], { from: null, radiusKm: null });
    expect(s.map((x) => x.c.key)).toEqual(["curated:goerlitz", "curated:berlin"]);
    expect(s[1].score).toBe(1); // only size
  });
  it("curated wins a tie over an automatic collection", () => {
    const auto = col("city:a", [near(11), near(12), near(13)]);
    const curated = col("curated:z", [near(21), near(22), near(23)]);
    expect(scoreCollections([auto, curated], { from: null, radiusKm: null }).map((s) => s.c.key)).toEqual(["curated:z", "city:a"]);
  });
});

describe("pins", () => {
  const big = col("title:big", Array.from({ length: 9 }, (_, i) => near(100 + i, { checkIn: true, photo: true })));
  const streaming = col("curated:netflix-berlin", [near(1), near(2), near(3)], 1);
  const coldWar = col("curated:cold-war-berlin", [near(4), near(5), near(6)], 2);
  const goerli = col("curated:goerliwood", [far(7), far(8), far(9)], 3);
  const ctx = { from: null, radiusKm: null };

  it("keeps the table pins in rank order, ahead of a better-scoring collection", () => {
    expect(featuredPicks([goerli, coldWar, streaming, big], ctx).map((c) => c.key))
      .toEqual(["curated:netflix-berlin", "curated:cold-war-berlin", "curated:goerliwood"]);
  });
  it("names no collection in code: without pins, the scores decide", () => {
    const unpinned = [goerli, coldWar, streaming].map((c) => ({ ...c, pinRank: null }));
    expect(featuredPicks([...unpinned, big], ctx)[0].key).toBe("title:big");
  });
  it("skips a pin without published places", () => {
    expect(pinned([col("curated:empty", [], 1), coldWar]).map((c) => c.key)).toEqual(["curated:cold-war-berlin"]);
  });
  it("fills the slots after the pins with the best scores", () => {
    const scored = col("city:goerlitz", [far(31, { checkIn: true }), far(32, { checkIn: true }), far(33, { checkIn: true })]);
    expect(featuredPicks([streaming, scored, coldWar], ctx).map((c) => c.key))
      .toEqual(["curated:netflix-berlin", "curated:cold-war-berlin", "city:goerlitz"]);
  });
});

describe("buildCollections", () => {
  const works: Work[] = [
    { id: "dark", title: "Dark", type: "series", aliases: [], year: null },
    { id: "bb", title: "Babylon Berlin", type: "series", aliases: [], year: null },
  ];
  const loc = (id: number, work_id: string, city: string, coord_quality: LiveLocation["coord_quality"] = "approx"): LiveLocation =>
    ({ id, work_id, name: `P${id}`, city, lat: 52.5, lng: 13.4, coord_quality });
  const locations = [
    loc(1, "dark", "Berlin", "source"), loc(2, "dark", "Berlin"), loc(3, "dark", "Görlitz"),
    loc(1, "bb", "Berlin", "source"), loc(4, "bb", "Berlin"), loc(5, "bb", "Berlin"), loc(6, "bb", "Berlin"),
  ];
  const all = buildCollections({ works, locations, collections: [{ id: "c", name: "Curated", city: "Berlin", work_ids: ["dark"], description: null, featured_rank: 2 }] });

  it("makes title collections for titles with 3+ places and city collections for cities with 5+", () => {
    expect(all.map((c) => c.key).sort()).toEqual(["city:berlin", "curated:c", "title:bb", "title:dark"]);
    const berlin = all.find((c) => c.key === "city:berlin")!;
    expect(berlin).toMatchObject({ name: "Filmed in Berlin", href: "/collection/city/berlin" });
    expect(berlin.places.map((p) => p.id)).toEqual([1, 2, 4, 5, 6]); // place 1 once, though filmed for two titles
  });
  it("lists each place once with all its titles and its check-in grade", () => {
    const p1 = all.find((c) => c.key === "title:dark")!.places[0];
    expect(p1).toMatchObject({ id: 1, checkIn: true, titles: ["Dark", "Babylon Berlin"] });
  });
  it("keeps the table pin on curated collections", () => {
    expect(all.find((c) => c.key === "curated:c")!.pinRank).toBe(2);
  });
  it("slugifies German city names", () => {
    expect(slugify("Görlitz")).toBe("goerlitz");
    expect(slugify("Berlin/Potsdam")).toBe("berlin-potsdam");
    expect(slugify("Straße am Fluss")).toBe("strasse-am-fluss");
  });
});
