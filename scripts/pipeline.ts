// The data pipeline from the command line (GitHub Actions runs it hourly). Needs migration 014.
// Usage: npm run pipeline -- --cron [--minutes 45]  (queue the daily jobs once a day, then work the queue)
//        npm run pipeline -- --minutes 5            (just work the queue)
//        npm run pipeline -- --title "Babylon Berlin" [--minutes 10]  (find one title now)
// AI calls stop at DAILY_AI_BUDGET (US dollars per UTC day); the rest waits for the next day.
import { config } from "dotenv";
import { enqueue, PRIORITY, queueDaily } from "../lib/pipeline/jobs";
import { runPipeline } from "../lib/pipeline/worker";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function main() {
  const db = supabaseAdmin();
  const minutes = Number(arg("--minutes") ?? 45);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("--minutes must be a positive number");
  const cron = process.argv.includes("--cron");
  const title = arg("--title");
  if (cron) console.log("daily jobs queued:", await queueDaily(db));
  if (title) console.log("title queued:", await enqueue(db, "title", { text: title.slice(0, 200) }, { priority: PRIORITY.request }));

  const s = await runPipeline(db, { trigger: cron ? "cron" : "manual", deadline: Date.now() + minutes * 60_000, log: console.log });
  console.log(`\nRun #${s.runId}: ${s.jobsDone} jobs done, ${s.jobsFailed} failed; ${s.candidates} new drafts, ${s.published} published, ` +
    `${s.needsReview} need review, ${s.rejected} rejected, ${s.merged} merged; ${s.aiCalls} AI calls, about $${s.costUsd} (estimate)` +
    `${s.budgetHit ? "; daily AI budget reached, the rest waits for tomorrow" : ""}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
