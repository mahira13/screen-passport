// Migration 015 (friend challenges) against a real database. `npm run test:db`.
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("migration 015: challenges", () => {
  const db = new Client({ connectionString: url });
  beforeAll(async () => {
    await db.connect();
    await db.query("insert into passports (id, watched, visited) select 'ch-' || g, '{}', '{}' from generate_series(0, 51) g on conflict do nothing");
    await db.query("insert into challenges (id, collection_id, created_by_passport) values ('ch-test', 'curated:x', 'ch-0') on conflict do nothing");
  });
  afterAll(async () => { await db.end(); });

  const join = async (passport: string, name = "Ana") =>
    (await db.query("select join_challenge('ch-test', $1, $2) as r", [passport, name])).rows[0].r;

  it("joins once per passport, renames on a second join, and stops at 50", async () => {
    expect(await join("ch-0")).toBe("ok");
    expect(await join("ch-0", "Ben")).toBe("already");
    expect((await db.query("select display_name from challenge_participants where passport_id = 'ch-0'")).rows[0].display_name).toBe("Ben");
    for (let i = 1; i < 50; i++) expect(await join(`ch-${i}`)).toBe("ok");
    expect(await join("ch-50")).toBe("full");
    expect((await db.query("select join_challenge('nope', 'ch-51', 'X') as r")).rows[0].r).toBe("not_found");
  });

  it("is closed to the public roles", async () => {
    await db.query("set role anon");
    await expect(db.query("select * from challenges")).rejects.toThrow(/permission denied/);
    await expect(db.query("select join_challenge('ch-test', 'ch-51', 'X')")).rejects.toThrow(/permission denied/);
    await db.query("reset role");
  });
});
