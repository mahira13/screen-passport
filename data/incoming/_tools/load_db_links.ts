// Loads data/incoming/seed/db_links.csv: extra titles at places that exist only in the database
// (not in data/seed, so `npm run seed` can't validate them). Run after `npm run seed`, which creates the titles.
// Usage: npx tsx data/incoming/_tools/load_db_links.ts [--dry-run]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { isUntrustedSource } from "../../../lib/sources";
import { supabaseAdmin } from "../../../lib/supabase";

config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows: Record<string, string>[] = parse(readFileSync(join(__dirname, "..", "seed", "db_links.csv"), "utf8"), {
    columns: true, skip_empty_lines: true, trim: true, bom: true,
  });
  const links = rows.map((r) => ({
    location_id: Number(r.location_id), work_id: r.work_id, scene_note: r.scene_note || null, depicts: r.depicts || null,
    evidence_url: r.evidence_url, evidence_name: r.evidence_name || null,
  }));
  const db = supabaseAdmin();
  const problems: string[] = [];
  for (const k of links) {
    if (!/^https?:\/\//.test(k.evidence_url) || isUntrustedSource(k.evidence_url)) problems.push(`${k.location_id}/${k.work_id}: bad evidence_url`);
    const [{ data: loc }, { data: work }] = await Promise.all([
      db.from("locations").select("id").eq("id", k.location_id).maybeSingle(),
      db.from("works").select("id").eq("id", k.work_id).maybeSingle(),
    ]);
    if (!loc) problems.push(`${k.location_id}/${k.work_id}: location not in the database`);
    if (!work) problems.push(`${k.location_id}/${k.work_id}: work not in the database (run npm run seed first)`);
  }
  if (problems.length) throw new Error("Not loaded:\n- " + problems.join("\n- "));
  console.log(`${links.length} links OK.`);
  if (dryRun) return console.log("Dry run: nothing written.");
  const { error } = await db.from("location_works").upsert(links, { onConflict: "location_id,work_id" });
  if (error) throw new Error(`location_works: ${error.message}`);
  console.log(`location_works: ${links.length} rows upserted.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
