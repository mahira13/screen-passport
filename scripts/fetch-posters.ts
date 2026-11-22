// Free-licensed posters from Wikimedia Commons for works. Claude confirms each one; only confirmed
// posters are stored ('auto'). Usage: npm run posters [-- --ids dark,tar] [--limit 10] [--dry-run] [--retry]
import { config } from "dotenv";
import { runPosters } from "../lib/images/run-posters";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const arg = (n: string) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };

async function main() {
  const s = await runPosters(supabaseAdmin(), {
    ids: arg("--ids")?.split(","), limit: arg("--limit") ? Number(arg("--limit")) : 200,
    dryRun: process.argv.includes("--dry-run"), retry: process.argv.includes("--retry"), log: console.log,
  });
  console.log(`\nTitles checked: ${s.checked}   Poster found: ${s.found}   None: ${s.none}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
