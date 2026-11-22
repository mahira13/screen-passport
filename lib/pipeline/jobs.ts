// The job queue (pipeline_jobs, migration 014). Server only.
import type { SupabaseClient } from "@supabase/supabase-js";

export type JobKind = "discover" | "title" | "research" | "verify" | "images" | "outline" | "dedupe" | "recheck";
export type Job = { id: number; kind: JobKind; payload: Record<string, unknown>; request_id: number | null; attempts: number; priority: number };

export const MAX_ATTEMPTS = 3;
export const PRIORITY = { request: 10, normal: 100, background: 200 } as const;

type EnqueueOptions = { requestId?: number | null; priority?: number; dedupeKey?: string; runAfter?: Date };

/** Queues a job; a job with the same dedupe key that hasn't finished yet is left as it is. */
export async function enqueue(db: SupabaseClient, kind: JobKind, payload: Record<string, unknown>, o: EnqueueOptions = {}): Promise<boolean> {
  const { error } = await db.from("pipeline_jobs").insert({
    kind, payload, request_id: o.requestId ?? null, priority: o.priority ?? PRIORITY.normal,
    dedupe_key: o.dedupeKey ?? null, run_after: (o.runAfter ?? new Date()).toISOString(),
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(`enqueue ${kind}: ${error.message}`);
  return true;
}

export async function claim(db: SupabaseClient, leaseSeconds: number, requestId: number | null, kinds: JobKind[] | null): Promise<Job | null> {
  const { data, error } = await db.rpc("claim_jobs", { p_limit: 1, p_lease_seconds: leaseSeconds, p_request_id: requestId, p_kinds: kinds });
  if (error) throw new Error(`claim: ${error.message} (is migration 014 applied?)`);
  return ((data ?? []) as Job[])[0] ?? null;
}

const update = async (db: SupabaseClient, id: number, patch: Record<string, unknown>) => {
  const { error } = await db.from("pipeline_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`job #${id}: ${error.message}`);
};

export const finish = (db: SupabaseClient, job: Job, result: unknown) =>
  update(db, job.id, { status: "done", result, locked_until: null, last_error: null });

/** Retries later with backoff (2, 4 minutes); after MAX_ATTEMPTS the job is marked failed. */
export function retryPlan(attempts: number, now = new Date()): { status: "queued" | "failed"; runAfter: Date } {
  if (attempts >= MAX_ATTEMPTS) return { status: "failed", runAfter: now };
  return { status: "queued", runAfter: new Date(now.getTime() + 2 ** attempts * 60_000) };
}

export function fail(db: SupabaseClient, job: Job, err: unknown) {
  const plan = retryPlan(job.attempts);
  return update(db, job.id, {
    status: plan.status, run_after: plan.runAfter.toISOString(), locked_until: null,
    last_error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
  });
}

/** Five past midnight UTC, when the daily AI budget starts again. */
export function nextBudgetDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5));
}

/** Out of AI budget: the job waits for tomorrow without using up an attempt. */
export const waitForBudget = (db: SupabaseClient, job: Job) =>
  update(db, job.id, { status: "waiting_budget", run_after: nextBudgetDay().toISOString(), locked_until: null, attempts: Math.max(0, job.attempts - 1) });

/** Queues a job unless one with this key exists in any state (for "once a day" jobs). */
export async function enqueueOnce(db: SupabaseClient, kind: JobKind, payload: Record<string, unknown>, dedupeKey: string, o: Omit<EnqueueOptions, "dedupeKey"> = {}): Promise<boolean> {
  const { count, error } = await db.from("pipeline_jobs").select("id", { count: "exact", head: true }).eq("dedupe_key", dedupeKey);
  if (error) throw new Error(error.message);
  return count ? false : enqueue(db, kind, payload, { ...o, dedupeKey });
}

/** The jobs the daily schedule adds (the hourly cron calls this; only the first call of a day queues). */
export async function queueDaily(db: SupabaseClient, day = new Date().toISOString().slice(0, 10)) {
  return {
    discover: await enqueueOnce(db, "discover", { offset: 0 }, `discover:${day}:0`, { priority: PRIORITY.background }),
    recheck: await enqueueOnce(db, "recheck", {}, `recheck:${day}`, { priority: PRIORITY.background }),
    dedupe: await enqueueOnce(db, "dedupe", {}, `dedupe:${day}`, { priority: PRIORITY.background }),
  };
}

/** Open (queued, running or budget-waiting) and running job counts for a request. */
export async function requestJobCounts(db: SupabaseClient, requestId: number): Promise<{ open: number; running: number; failed: number }> {
  const { data, error } = await db.from("pipeline_jobs").select("status").eq("request_id", requestId);
  if (error) throw new Error(error.message);
  const s = (data ?? []).map((r) => r.status as string);
  return {
    open: s.filter((x) => x === "queued" || x === "running" || x === "waiting_budget").length,
    running: s.filter((x) => x === "running").length,
    failed: s.filter((x) => x === "failed").length,
  };
}
