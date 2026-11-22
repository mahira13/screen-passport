// Migration 007 against a real PostGIS database. Run with `npm run test:db` (needs Docker);
// skipped in `npm test`. Tests run in order; the merge test changes data, so it is last.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CITY } from "@/lib/cities";
import { buildNearby, type LiveLocation } from "@/lib/nearby";
import { toLocation, toWork } from "../../scripts/seed-rows";

const url = process.env.TEST_DATABASE_URL;
const read = (f: string): Record<string, string>[] =>
  parse(readFileSync(join(__dirname, "..", "..", "data", "seed", f), "utf8"), { columns: true, trim: true, bom: true });

type NearbyRow = { id: number; distance_km: number; works: { id: string; title: string }[] };

describe.skipIf(!url)("migration 007: catalogue", () => {
  const db = new Client({ connectionString: url });
  const nearby = async (args: string, params: unknown[]) =>
    (await db.query<NearbyRow>(`select * from nearby_locations(${args})`, params)).rows;
  const asAnon = async <T,>(sql: string, params: unknown[] = []) => {
    await db.query("begin; set local role anon");
    try {
      return (await db.query(sql, params)).rows as T[];
    } finally {
      await db.query("rollback");
    }
  };

  beforeAll(() => db.connect());
  afterAll(() => db.end());

  it("backfills one location_works row per old location, with its scene note", async () => {
    const { rows } = await db.query(`select
      (select count(*) from locations where work_id is not null)::int as locations,
      (select count(*) from location_works)::int as links,
      (select count(*) from location_works lw join locations l on l.id = lw.location_id
        where lw.work_id = l.work_id and lw.scene_note is not distinct from l.scene_note)::int as matching`);
    expect(rows[0].links).toBe(rows[0].locations);
    expect(rows[0].matching).toBe(rows[0].locations);
  });

  it("publishes exactly the live rows, sets Germany and fills geog from lat/lng", async () => {
    const { rows } = await db.query(`select
      count(*) filter (where status = 'live')::int as live,
      count(*) filter (where verification_status = 'published')::int as published,
      count(*) filter (where status = 'live' and verification_status = 'published' and verified_at is not null)::int as both,
      count(*) filter (where country_code = 'DE' and country = 'Germany')::int as german,
      count(*)::int as total,
      count(*) filter (where (lat is null) = (geog is null))::int as geog_ok,
      count(*) filter (where location_confidence is null and public_access = 'unknown' and is_filming_location)::int as defaults
      from locations`);
    const r = rows[0];
    expect(r.live).toBeGreaterThan(0);
    expect(r.published).toBe(r.live);
    expect(r.both).toBe(r.live);
    expect(r.german).toBe(r.total);
    expect(r.geog_ok).toBe(r.total);
    expect(r.defaults).toBe(r.total); // confidence is never guessed
  });

  it("nearby_locations from Berlin returns the same places, order and distances as the app", async () => {
    const works = read("titles.csv").map(toWork);
    const live: LiveLocation[] = read("locations.csv").map(toLocation).filter((l) => l.lat !== null)
      .map((l) => ({ id: l.id, work_id: l.work_id, name: l.name, city: l.city, lat: l.lat, lng: l.lng, coord_quality: l.coord_quality }));
    const expected = buildNearby(live, works, DEFAULT_CITY).places;
    const rows = await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng]);
    expect(rows.map((r) => r.id)).toEqual(expected.map((p) => p.id));
    rows.forEach((r, i) => expect(r.distance_km).toBeCloseTo(expected[i].distanceKm, 2));
    expect(rows.every((r) => r.works.length === 1)).toBe(true); // no merges yet
  });

  it("filters by radius, by title and caps the number of results", async () => {
    const all = await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng]);
    const near = await nearby("$1, $2, 5", [DEFAULT_CITY.lat, DEFAULT_CITY.lng]);
    expect(near.length).toBe(all.filter((r) => r.distance_km <= 5).length);
    expect(near.length).toBeGreaterThan(0);
    const dark = await nearby("$1, $2, null, 'dark'", [DEFAULT_CITY.lat, DEFAULT_CITY.lng]);
    expect(dark.length).toBeGreaterThan(0);
    expect(dark.every((r) => r.works.some((w) => w.id === "dark"))).toBe(true);
    expect(await nearby("$1, $2, null, null, 3", [DEFAULT_CITY.lat, DEFAULT_CITY.lng])).toHaveLength(3);
  });

  it("never returns unpublished places or story settings", async () => {
    await db.query("begin");
    try {
      const [first] = await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng]);
      await db.query("update locations set is_filming_location = false where id = $1", [first.id]);
      const [second] = (await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng])).slice(0, 1);
      await db.query("update locations set verification_status = 'verified' where id = $1", [second.id]);
      const ids = (await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng])).map((r) => r.id);
      expect(ids).not.toContain(first.id);
      expect(ids).not.toContain(second.id);
    } finally {
      await db.query("rollback");
    }
  });

  it("keeps status and verification_status in step, both ways", async () => {
    await db.query("begin");
    try {
      const row = async (id: number) => (await db.query("select status, verification_status from locations where id = $1", [id])).rows[0];
      await db.query("update locations set status = 'unverified' where id = 32"); // admin un-publishes the old way
      expect(await row(32)).toEqual({ status: "unverified", verification_status: "verified" });
      await db.query("update locations set verification_status = 'published' where id = 32");
      expect(await row(32)).toEqual({ status: "live", verification_status: "published" });
      await db.query("update locations set status = 'live' where id = 1"); // old admin "Live" button
      expect((await row(1)).verification_status).toBe("published");
    } finally {
      await db.query("rollback");
    }
  });

  it("gives new rows from old writers a location_works row", async () => {
    await db.query("begin");
    try {
      await db.query(`insert into locations (id, work_id, name, scene_note, source_url, lat, lng, status)
        values (9001, 'dark', 'Test place', 'A scene', 'https://example.org', 52.5, 13.4, 'live')`);
      const { rows } = await db.query("select work_id, scene_note from location_works where location_id = 9001");
      expect(rows).toEqual([{ work_id: "dark", scene_note: "A scene" }]);
      expect((await nearby("52.5, 13.4, 0.1", [])).map((r) => r.id)).toContain(9001);
    } finally {
      await db.query("rollback");
    }
  });

  it("lets the public read only published places and their titles", async () => {
    const hidden = await asAnon<{ n: number }>("select count(*)::int as n from locations where verification_status <> 'published'");
    expect(hidden[0].n).toBe(0);
    const links = await asAnon<{ n: number }>(
      "select count(*)::int as n from location_works lw where not exists (select 1 from locations l where l.id = lw.location_id)");
    expect(links[0].n).toBe(0);
    const rows = await asAnon<NearbyRow>("select * from nearby_locations(52.52, 13.405, 5)");
    expect(rows.length).toBeGreaterThan(0);
    await expect(asAnon("select merge_locations(32, '{55}')")).rejects.toThrow(/permission denied/);
  });

  it("search_catalogue finds works by title or alias, cities and countries", async () => {
    const search = async (q: string) =>
      (await db.query<{ kind: string; id: string; places: number }>("select * from search_catalogue($1)", [q])).rows;
    expect((await search("babylon")).find((r) => r.kind === "work")?.id).toBe("babylon-berlin");
    expect((await search("damengambit")).find((r) => r.kind === "work")?.id).toBe("queens-gambit"); // German alias
    expect((await search("görl")).find((r) => r.kind === "city")?.id).toBe("Görlitz");
    const country = (await search("germ")).find((r) => r.kind === "country");
    expect(country).toMatchObject({ id: "DE" });
    expect(country!.places).toBeGreaterThan(0);
    expect(await search("x")).toEqual([]); // too short
  });

  it("the five approved merges keep every title, its source and scene note, and remap trips and passports", async () => {
    const links = async (id: number) => (await db.query(
      "select work_id, scene_note, source_name, source_url from catalogue_entries where id = $1 order by work_id", [id])).rows;
    const before = new Map<string, unknown>();
    for (const id of [22, 56, 25, 33, 32, 55, 63, 45, 58, 60, 68]) for (const l of await links(id)) before.set(l.work_id + "@" + id, l);

    for (const [keep, drop] of [[22, [56]], [25, [33]], [32, [55, 63]], [45, [58]], [60, [68]]] as const) {
      await db.query("select merge_locations($1, $2)", [keep, drop]);
      const kept = await links(keep);
      for (const id of [keep, ...drop]) {
        for (const [key, link] of before) {
          if (!key.endsWith("@" + id)) continue;
          const { work_id, scene_note, source_name, source_url } = link as Record<string, string>;
          expect(kept).toContainEqual({ work_id, scene_note, source_name, source_url }); // nothing lost
        }
      }
    }
    const alex = await links(32);
    expect(alex.map((l) => l.work_id)).toEqual(["atomic-blonde", "babylon-berlin", "bourne-supremacy"]);
    expect(alex.find((l) => l.work_id === "bourne-supremacy")?.scene_note).toMatch(/at the World Clock/);

    const ids = (await nearby("$1, $2", [DEFAULT_CITY.lat, DEFAULT_CITY.lng])).map((r) => r.id);
    for (const gone of [56, 33, 55, 63, 58, 68]) expect(ids).not.toContain(gone);
    const dropped = (await db.query("select merged_into, verification_status, status from locations where id = 55")).rows[0];
    expect(dropped).toEqual({ merged_into: 32, verification_status: "rejected", status: "unverified" });

    const trip = (await db.query("select plan from trips where id = 'trip-merge-test'")).rows[0];
    expect(trip.plan.stops.map((s: { location_id: number }) => s.location_id)).toEqual([32, 22]);
    const passport = (await db.query("select visited from passports where id = 'passport-merge-test'")).rows[0];
    expect([...passport.visited].sort((a: number, b: number) => a - b)).toEqual([22, 32]);

    await expect(db.query("select merge_locations(32, '{32}')")).rejects.toThrow(/itself/);
  });
});

describe.skipIf(!url)("migration 008: verification", () => {
  const db = new Client({ connectionString: url });
  beforeAll(() => db.connect());
  afterAll(() => db.end());

  it("accepts needs_review, marks published rows as team-verified and hides review logs from the public", async () => {
    await db.query("begin");
    try {
      await db.query("update locations set verification_status = 'needs_review' where id = 1");
      expect((await db.query("select status from locations where id = 1")).rows[0].status).toBe("unverified");
      const { rows } = await db.query("select count(*) filter (where verification_method = 'team')::int as team, count(*)::int as all from locations where verification_status = 'published'");
      expect(rows[0].team).toBe(rows[0].all);
      await db.query("insert into location_reviews (location_id, method, decision, reasons, evidence_quote) values (32, 'ai', 'published', '{}', 'quote')");
      await db.query("set local role anon");
      await db.query("savepoint denied");
      await expect(db.query("select * from location_reviews")).rejects.toThrow(/permission denied/);
      await db.query("rollback to savepoint denied");
      const badge = await db.query("select verification_method from nearby_locations(52.52, 13.405, 1) limit 1");
      await db.query("reset role");
      const weak = await db.query(`select verification_status, count(*)::int as n from locations
        where source_url ~* '(giggster|foodieexplorers)' and verification_status in ('draft', 'needs_review') group by 1`);
      expect(weak.rows.every((r) => r.verification_status === "needs_review")).toBe(true);
      expect(weak.rows.reduce((n, r) => n + r.n, 0)).toBeGreaterThan(0);
      expect(badge.rows[0].verification_method).toBe("team");
    } finally {
      await db.query("rollback");
    }
  });
});

describe.skipIf(!url)("migration 009: images", () => {
  const db = new Client({ connectionString: url });
  beforeAll(() => db.connect());
  afterAll(() => db.end());
  const pub = "select id from locations where verification_status = 'published' and is_filming_location and merged_into is null and lat is not null order by id limit 1";
  const photo = `image_thumb_url = 'https://upload.wikimedia.org/a/800px-X.jpg', image_author = 'Jane Doe',
    image_license = 'CC BY-SA 4.0', image_source_page = 'https://commons.wikimedia.org/wiki/File:X.jpg'`;

  it("requires a full Commons credit before a photo can be auto or approved", async () => {
    await db.query("begin");
    try {
      const id = (await db.query(pub)).rows[0].id;
      await db.query("savepoint s");
      await expect(db.query("update locations set image_status = 'approved' where id = $1", [id])).rejects.toThrow(/locations_image_credit_check/);
      await db.query("rollback to savepoint s");
      await db.query(`update locations set ${photo} where id = $1`, [id]); // a photo waiting for review
      await db.query("savepoint p");
      await expect(db.query("update locations set image_author = null, image_status = 'auto' where id = $1", [id])).rejects.toThrow(/locations_image_credit_check/);
      await db.query("rollback to savepoint p");
      await expect(db.query("update locations set image_source_page = 'https://example.com/X.jpg' where id = $1", [id])).rejects.toThrow(/check/);
      await db.query("rollback to savepoint p");
      await db.query(`update locations set ${photo}, image_status = 'approved', image_skip = '{"File:Old.jpg"}' where id = $1`, [id]);
      await db.query("update locations set image_status = 'rejected', image_thumb_url = null, image_author = null, image_license = null, image_source_page = null where id = $1", [id]);
    } finally {
      await db.query("rollback");
    }
  });

  it("shows the public a photo only when it is auto or approved", async () => {
    await db.query("begin");
    try {
      const id = (await db.query(pub)).rows[0].id;
      await db.query(`update locations set ${photo}, image_status = null where id = $1`, [id]);
      const shown = async () => {
        await db.query("set local role anon");
        const r = await db.query("select image_thumb_url, image_author from catalogue_entries where id = $1 limit 1", [id]);
        await db.query("reset role");
        return r.rows[0];
      };
      expect(await shown()).toEqual({ image_thumb_url: null, image_author: null });
      await db.query("update locations set image_status = 'approved' where id = $1", [id]);
      expect((await shown()).image_author).toBe("Jane Doe");
    } finally {
      await db.query("rollback");
    }
  });

  it("backfills wikidata_id only from exact Wikidata item URLs", async () => {
    await db.query("begin");
    try {
      const ids = (await db.query("select id from locations order by id limit 3")).rows.map((r) => r.id);
      await db.query("update locations set wikidata_id = null, source_url = $2 where id = $1", [ids[0], "https://www.wikidata.org/wiki/Q64"]);
      await db.query("update locations set wikidata_id = null, source_url = $2 where id = $1", [ids[1], "https://www.wikidata.org/wiki/Q64abc"]);
      await db.query("update locations set wikidata_id = null, source_url = $2 where id = $1", [ids[2], "https://example.com/?u=wikidata.org/wiki/Q64"]);
      // Only the backfill: later migrations extend the view, so the whole file can't be replayed here.
      const sql = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "009_images.sql"), "utf8");
      await db.query(sql.match(/update public\.locations\s+set wikidata_id[\s\S]*?;/)![0]);
      const { rows } = await db.query("select id, wikidata_id from locations where id = any($1) order by id", [ids]);
      expect(rows.map((r) => r.wikidata_id)).toEqual(["Q64", null, null]);
    } finally {
      await db.query("rollback");
    }
  });
});

describe.skipIf(!url)("migration 010: featured collections", () => {
  const db = new Client({ connectionString: url });
  beforeAll(() => db.connect());
  afterAll(() => db.end());

  it("orders featured collections by rank and keeps each rank unique", async () => {
    await db.query("begin");
    try {
      await db.query("insert into collections (id, name, work_ids) values ('test-a', 'Test A', '{}'), ('test-b', 'Test B', '{}')");
      const ids = ["test-a", "test-b"];
      await db.query("update collections set featured_rank = 2 where id = $1", [ids[0]]);
      await db.query("update collections set featured_rank = 1 where id = $1", [ids[1]]);
      const { rows } = await db.query("select id from collections where featured_rank is not null order by featured_rank");
      expect(rows.map((r) => r.id)).toEqual([ids[1], ids[0]]);
      await db.query("savepoint s");
      await expect(db.query("update collections set featured_rank = 1 where id = $1", [ids[0]])).rejects.toThrow(/collections_featured_rank_key/);
      await db.query("rollback to savepoint s");
      await expect(db.query("update collections set featured_rank = 0 where id = $1", [ids[0]])).rejects.toThrow(/check/);
    } finally {
      await db.query("rollback");
    }
  });
});

describe.skipIf(!url)("migration 011: search ignores accents and German spellings", () => {
  const db = new Client({ connectionString: url });
  beforeAll(() => db.connect());
  afterAll(() => db.end());
  const first = async (q: string, kind?: string) => {
    await db.query("begin; set local role anon");
    try {
      const rows = (await db.query<{ kind: string; id: string }>("select kind, id from search_catalogue($1)", [q])).rows;
      return (kind ? rows.find((r) => r.kind === kind) : rows[0]) ?? null;
    } finally {
      await db.query("rollback");
    }
  };

  it("normalises umlauts, ß and their spelled-out forms the same way", async () => {
    const norm = async (t: string) => (await db.query("select public.search_norm($1) as n", [t])).rows[0].n;
    expect(await norm("Straße Görlitz Müller")).toBe("strasse gorlitz muller");
    expect(await norm("Goerlitz")).toBe(await norm("Görlitz"));
    expect(await norm("Mueller")).toBe(await norm("Müller"));
    expect(await norm("Strasse")).toBe(await norm("Straße"));
  });

  it.each(["gorl", "goerl", "görl", "GÖRLITZ", "Goerlitz"])("%s finds Görlitz", async (q) => {
    expect(await first(q, "city")).toMatchObject({ id: "Görlitz" });
  });

  it("still finds titles, German aliases and country codes, as the public", async () => {
    expect(await first("babylon", "work")).toMatchObject({ id: "babylon-berlin" });
    expect(await first("damengambit", "work")).toMatchObject({ id: "queens-gambit" });
    expect(await first("de", "country")).toMatchObject({ id: "DE" });
    expect(await first("x")).toBeNull();
  });

  it("uses an index-safe (immutable) normaliser", async () => {
    const { rows } = await db.query(`select provolatile from pg_proc where proname in ('search_norm', 'work_search_text')`);
    expect(rows.map((r) => r.provolatile)).toEqual(["i", "i"]);
    expect((await db.query("select 1 from pg_indexes where indexname = 'works_search_trgm'")).rowCount).toBe(1);
  });
});

describe.skipIf(!url)("migration 013: aliases and site outlines", () => {
  const db = new Client({ connectionString: url });
  beforeAll(() => db.connect());
  afterAll(() => db.end());
  const square = { type: "Polygon", coordinates: [[[13.18, 52.38], [13.19, 52.38], [13.19, 52.39], [13.18, 52.39], [13.18, 52.38]]] };

  it("stores only Polygon or MultiPolygon outlines and shows them in the public view", async () => {
    await db.query("begin");
    try {
      const id = (await db.query("select id from catalogue_entries order by id limit 1")).rows[0].id;
      await db.query("savepoint s");
      await expect(db.query("update locations set check_in_area = $2 where id = $1", [id, { type: "Point", coordinates: [13, 52] }])).rejects.toThrow(/check/);
      await db.query("rollback to savepoint s");
      await db.query("update locations set check_in_area = $2, aliases = '{Other name}' where id = $1", [id, square]);
      await db.query("set local role anon");
      const { rows } = await db.query("select check_in_area from catalogue_entries where id = $1 limit 1", [id]);
      expect(rows[0].check_in_area).toEqual(square);
      await db.query("savepoint a");
      await expect(db.query("select aliases from catalogue_entries limit 1")).rejects.toThrow(/aliases/); // internal, not in the view
      await db.query("rollback to savepoint a");
    } finally {
      await db.query("rollback");
    }
  });

  it("sets the library aliases and the cemetery note by name, once", async () => {
    const lib = await db.query("select aliases from locations where name = 'Berlin State Library, Unter den Linden'");
    for (const r of lib.rows) expect(r.aliases).toEqual(["Staatsbibliothek zu Berlin", "Staatsbibliothek Unter den Linden"]);
    const cem = await db.query("select visit_note from locations where name = 'Südwestkirchhof Stahnsdorf'");
    for (const r of cem.rows) expect(r.visit_note).toBe("Working cemetery — please visit quietly and respect graves and mourners.");
  });
});
