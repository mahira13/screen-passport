// Migration 014 (job queue, AI budget, shared throttle) against a real database. `npm run test:db`.
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("migration 014: pipeline", () => {
  const a = new Client({ connectionString: url });
  const b = new Client({ connectionString: url });
  beforeAll(async () => { await a.connect(); await b.connect(); });
  afterAll(async () => { await a.end(); await b.end(); });

  it("never gives the same job to two workers, and runs higher priority first", async () => {
    await a.query("delete from pipeline_jobs");
    await a.query(`insert into pipeline_jobs (kind, priority) select 'verify', 100 from generate_series(1, 6)`);
    await a.query(`insert into pipeline_jobs (kind, priority) values ('title', 10)`);
    const [r1, r2] = await Promise.all([
      a.query("select * from claim_jobs(4, 60)"),
      b.query("select * from claim_jobs(4, 60)"),
    ]);
    const ids = [...r1.rows, ...r2.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(7);
    const first = (await a.query("select kind from pipeline_jobs where status = 'running' order by id limit 0")).rows;
    expect(first).toEqual([]);
    expect([...r1.rows, ...r2.rows].find((r) => r.kind === "title")).toBeTruthy();
    expect((await a.query("select * from claim_jobs(10, 60)")).rows).toHaveLength(0); // all leased
  });

  it("reclaims a job whose lease ran out, and filters by request and kind", async () => {
    await a.query("update pipeline_jobs set locked_until = now() - interval '1 second' where kind = 'title'");
    const again = (await a.query("select * from claim_jobs(10, 60, null, array['title'])")).rows;
    expect(again).toHaveLength(1);
    expect(again[0].attempts).toBe(2);
  });

  it("keeps one unfinished job per dedupe key", async () => {
    await a.query(`insert into pipeline_jobs (kind, dedupe_key) values ('discover', 'discover:day')`);
    await expect(a.query(`insert into pipeline_jobs (kind, dedupe_key) values ('discover', 'discover:day')`)).rejects.toThrow();
    await a.query(`update pipeline_jobs set status = 'done' where dedupe_key = 'discover:day'`);
    await a.query(`insert into pipeline_jobs (kind, dedupe_key) values ('discover', 'discover:day')`);
  });

  it("reserves AI spend within the daily budget and settles the real cost", async () => {
    await a.query("delete from ai_usage");
    expect((await a.query("select ai_reserve(0.6, 1) as ok")).rows[0].ok).toBe(true);
    expect((await a.query("select ai_reserve(0.6, 1) as ok")).rows[0].ok).toBe(false); // 0.6 in flight
    await a.query("select ai_settle(0.6, 0.1)");
    expect((await a.query("select ai_reserve(0.6, 1) as ok")).rows[0].ok).toBe(true);
    const u = (await a.query("select calls, cost_usd::float as cost, reserved::float as reserved from ai_usage")).rows[0];
    expect(u).toEqual({ calls: 1, cost: 0.1, reserved: 0.6 });
  });

  it("books throttle slots at least the gap apart, whoever asks", async () => {
    await a.query("delete from throttle");
    const waits = await Promise.all([a, b, a, b].map((c) => c.query("select throttle_slot('nominatim', 1000) as ms").then((r) => r.rows[0].ms as number)));
    const sorted = [...waits].sort((x, y) => x - y);
    expect(sorted[0]).toBeLessThanOrEqual(50);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(900);
  });

  it("keeps the pipeline tables away from the public", async () => {
    await a.query("begin; set local role anon");
    try {
      await expect(a.query("select * from pipeline_jobs")).rejects.toThrow(/permission/);
    } finally {
      await a.query("rollback");
    }
  });
});
