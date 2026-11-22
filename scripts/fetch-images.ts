// Commons photos for published locations without one. Claude checks each candidate; only matches
// are shown publicly ('auto'), the rest wait for review in /admin/locations.
// Usage: npm run images [-- --ids 32,44] [--limit 10] [--dry-run]
import { config } from "dotenv";
import { runImages } from "../lib/images/run";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const arg = (n: string) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };

async function main() {
  const ids = arg("--ids")?.split(",").map(Number).filter(Number.isInteger);
  const limit = arg("--limit") ? Number(arg("--limit")) : 100;
  const s = await runImages(supabaseAdmin(), { ids, limit, dryRun: process.argv.includes("--dry-run"), log: console.log });
  console.log(`\nImages found: ${s.found}   Auto-approved: ${s.auto}   Needs review: ${s.review}   No image: ${s.none}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
