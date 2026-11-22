// Migration 016 against a real database. Run with `npm run test:db` (needs Docker).
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("migration 016: public roles are read-only", () => {
  const db = new Client({ connectionString: url });
  const asAnon = async (sql: string) => {
    await db.query("begin; set local role anon");
    try {
      return (await db.query(sql)).rows;
    } finally {
      await db.query("rollback");
    }
  };

  beforeAll(() => db.connect());
  afterAll(() => db.end());

  it("cannot write passports, requests or events directly", async () => {
    await expect(asAnon("insert into passports (id, watched, visited) values ('anon-test', '{}', '{}')")).rejects.toThrow(/permission denied/);
    await expect(asAnon("insert into requests (raw_title, normalised_title) values ('x', 'x')")).rejects.toThrow(/permission denied/);
    await expect(asAnon("insert into events (name) values ('search')")).rejects.toThrow(/permission denied/);
  });

  it("cannot change the catalogue", async () => {
    await expect(asAnon("update locations set name = 'x'")).rejects.toThrow(/permission denied/);
    await expect(asAnon("delete from location_works")).rejects.toThrow(/permission denied/);
    await expect(asAnon("insert into works (id, title, type) values ('x', 'x', 'film')")).rejects.toThrow(/permission denied/);
  });

  it("reads published places only", async () => {
    const rows = await asAnon("select count(*)::int as n from locations where verification_status <> 'published'");
    expect(rows[0].n).toBe(0);
  });

  it("accepts the new analytics events", async () => {
    await db.query("begin");
    try {
      await db.query("insert into events (name) values ('search'), ('page_viewed')");
    } finally {
      await db.query("rollback");
    }
  });
});
