// Runs queued jobs until a deadline, one at a time, and logs the run in pipeline_runs. Used by the
// hourly cron (scripts/pipeline.ts) and by the title-request routes, which give it a few seconds
// per call. A job only starts if its usual duration fits before the deadline; a job cut off
// anyway (function timeout) is reclaimed when its lease runs out. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiTally, BudgetExhausted, resetAiTally } from "./ai";
import { claim, fail, finish, type Job, type JobKind, requestJobCounts, waitForBudget } from "./jobs";
import * as steps from "./steps";

// Usual worst case per job, in seconds: a job starts only with this much time left.
export const EXPECTED_S: Record<JobKind, number> = {
  discover: 40, title: 25, research: 45, verify: 35, images: 40, outline: 15, dedupe: 20, recheck: 10,
};
const LEASE_S = 600;
const AI_KINDS: JobKind[] = ["research", "verify", "images"];

export type RunOptions = {
  trigger: "cron" | "request" | "manual";
  deadline: number; // epoch ms
  requestId?: number | null; // only this request's jobs
  kinds?: JobKind[] | null;
  log?: (line: string) => void;
};

export type RunSummary = steps.Stats & { runId: number | null; jobsDone: number; jobsFailed: number; budgetHit: boolean; aiCalls: number; costUsd: number };

async function handle(db: SupabaseClient, job: Job, stats: steps.Stats): Promise<unknown> {
  switch (job.kind) {
    case "discover": return steps.discover(db, job);
    case "title": return steps.title(db, job, stats);
    case "research": return steps.researchStep(db, job, stats);
    case "verify": return steps.verify(db, job, stats);
    case "images": return steps.images(db, job);
    case "outline": return steps.outline(db, job);
    case "dedupe": return steps.dedupe(db, job, stats);
    case "recheck": return steps.recheck(db);
  }
}

/** found / nothing once a request has no open jobs left (counted from published places). */
export async function settleRequest(db: SupabaseClient, requestId: number) {
  const counts = await requestJobCounts(db, requestId);
  if (counts.open > 0) return;
  const { data: req } = await db.from("requests").select("work_id, search_status").eq("id", requestId).single();
  if (!req || req.search_status === "nothing") return; // already settled with its own message
  let found = 0;
  if (req.work_id) {
    const { data } = await db.from("catalogue_entries").select("id").eq("work_id", req.work_id);
    found = new Set((data ?? []).map((r) => r.id)).size;
  }
  const status = found > 0 ? "found" : counts.failed > 0 ? "failed" : "nothing";
  await db.from("requests").update({ search_status: status, found, status: found > 0 ? "researched" : "open" }).eq("id", requestId);
}

export async function runPipeline(db: SupabaseClient, o: RunOptions): Promise<RunSummary> {
  const log = o.log ?? (() => {});
  const stats = steps.emptyStats();
  let jobsDone = 0, jobsFailed = 0, budgetHit = false;
  resetAiTally();
  const { data: run } = await db.from("pipeline_runs").insert({ trigger: o.trigger }).select("id").single();
  let kinds = o.kinds ?? null;

  while (Date.now() < o.deadline) {
    const left = (o.deadline - Date.now()) / 1000;
    const fits = (Object.keys(EXPECTED_S) as JobKind[]).filter((k) => EXPECTED_S[k] <= left && (!kinds || kinds.includes(k)));
    if (!fits.length) break;
    const job = await claim(db, LEASE_S, o.requestId ?? null, fits);
    if (!job) break;
    log(`job #${job.id} ${job.kind} ${JSON.stringify(job.payload)}`);
    try {
      const result = await handle(db, job, stats);
      await finish(db, job, result);
      jobsDone++;
      log(`  done: ${JSON.stringify(result).slice(0, 300)}`);
    } catch (e) {
      if (e instanceof BudgetExhausted) {
        await waitForBudget(db, job);
        budgetHit = true;
        log(`  waiting for AI budget: ${e.message}`);
        kinds = (kinds ?? (Object.keys(EXPECTED_S) as JobKind[])).filter((k) => !AI_KINDS.includes(k)); // keep doing non-AI work
        if (!kinds.length) break;
      } else {
        await fail(db, job, e);
        jobsFailed++;
        log(`  failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (job.request_id !== null) await settleRequest(db, job.request_id);
  }

  const summary: RunSummary = { ...stats, runId: run?.id ?? null, jobsDone, jobsFailed, budgetHit, aiCalls: aiTally.calls, costUsd: Math.round(aiTally.cost * 10_000) / 10_000 };
  // A request poll that found nothing to do isn't worth a log row.
  if (run && (jobsDone || jobsFailed || budgetHit || o.trigger !== "request")) {
    await db.from("pipeline_runs").update({
      finished_at: new Date().toISOString(), jobs_done: jobsDone, jobs_failed: jobsFailed, candidates_in: stats.candidates,
      published: stats.published, needs_review: stats.needsReview, rejected: stats.rejected, merged: stats.merged,
      ai_calls: summary.aiCalls, cost_usd: summary.costUsd, budget_hit: budgetHit, notes: stats.notes.slice(0, 50),
    }).eq("id", run.id);
  } else if (run) {
    await db.from("pipeline_runs").delete().eq("id", run.id);
  }
  return summary;
}
