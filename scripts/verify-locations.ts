// AI verification for draft locations and those marked for re-check (CLAUDE.md product rule 4).
// Usage: npm run verify                         (queue: drafts + re-check, up to 20)
//        npm run verify -- --ids 34,35,44        (just these)
//        npm run verify -- --limit 5 --dry-run   (decide and print, save nothing)
import { config } from "dotenv";
import { supabaseAdmin } from "../lib/supabase";
import { runVerification } from "../lib/verify/run";

config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const ids = arg("--ids")?.split(",").map(Number).filter(Number.isInteger);
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("Dry run: nothing is saved.\n");
  const s = await runVerification(supabaseAdmin(), { ids, limit, dryRun, log: (l) => console.log(l) });
  console.log(`\nPublished: ${s.published}   Needs review: ${s.results.length - s.published - s.rejected}   Rejected: ${s.rejected}`);
  for (const [reason, n] of Object.entries(s.needsReview).sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${reason}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
