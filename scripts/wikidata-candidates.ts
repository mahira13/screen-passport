// Wikidata filming locations (P915) in the launch region for our works, as DRAFT candidates.
// Never publishes: drafts go through `npm run verify` (or a teammate) with a trusted source.
// Usage: npm run wikidata                              (all works, print only)
//        npm run wikidata -- --works dark,unorthodox   (just these)
//        npm run wikidata -- --qid unknown-2011=Q207136 (when a title is ambiguous)
//        npm run wikidata -- --apply                   (insert the new candidates as draft)
import { config } from "dotenv";
import { normaliseTitle } from "../lib/match";
import { searchItems, sparql } from "../lib/pipeline/sources-net";
import { supabaseAdmin } from "../lib/supabase";
import type { Work } from "../lib/types";
import {
  draftRow, filmingLocationsQuery, findExisting, pickWorkItem, toCandidate, toWorkItem,
  workTypesQuery, type Existing,
} from "../lib/wikidata";

config({ path: ".env.local" });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const args = (name: string) => process.argv.flatMap((a, i) => (process.argv[i - 1] === name ? [a] : []));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resolve(work: Work, overrides: Map<string, string>): Promise<string | null> {
  const fixed = overrides.get(work.id);
  if (fixed) return fixed;
  const hits = [...new Set([...(await searchItems(work.title)), ...(work.aliases[0] ? await searchItems(work.aliases[0]) : [])])];
  if (!hits.length) return null;
  const picked = pickWorkItem(work, (await sparql(workTypesQuery(hits))).map(toWorkItem), normaliseTitle);
  if ("qid" in picked) return picked.qid;
  const list = picked.ambiguous.map((i) => `${i.qid} (${i.labels[0]}, ${i.year ?? "?"})`).join(", ");
  console.log(`  ${work.id}: ${picked.ambiguous.length ? `ambiguous: ${list}` : "no film/series item found"}. Pass --qid ${work.id}=Q…`);
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const only = arg("--works")?.split(",");
  const overrides = new Map(args("--qid").map((s) => s.split("=") as [string, string]));
  const db = supabaseAdmin();

  const { data: works, error } = await db.from("works").select("id, title, type, aliases, year").order("id");
  if (error) throw error;
  const { data: places, error: e2 } = await db.from("locations").select("id, name, city, lat, lng");
  if (e2) throw e2;
  const existing: Existing[] = [...places];

  let added = 0;
  for (const work of (works as Work[]).filter((w) => !only || only.includes(w.id))) {
    const qid = await resolve(work, overrides);
    await pause(500);
    if (!qid) continue;
    const rows = (await sparql(filmingLocationsQuery(qid))).map(toCandidate);
    await pause(500);
    console.log(`\n${work.title} (${qid}): ${rows.length} filming locations in Germany on Wikidata`);
    for (const c of rows) {
      const where = `${c.name}${c.city ? `, ${c.city}` : ""} [${c.qid}, ${c.confidence}]`;
      if (c.skip) { console.log(`  skip      ${where}: ${c.skip}`); continue; }
      const have = findExisting(c, existing);
      if (have) {
        const near = have.metres === null ? "" : `, ${have.metres} m away`;
        console.log(`  have #${have.place.id}  ${where} (maybe our "${have.place.name}"${near}; add a title link by hand if it's missing)`);
        continue;
      }
      const row = draftRow(c, work.id);
      console.log(`  new       ${where} source: ${row.source_name}`);
      if (!apply) continue;
      const { data, error: insErr } = await db.from("locations").insert(row).select("id").single();
      if (insErr) { console.log(`    not inserted: ${insErr.message}`); continue; }
      existing.push({ id: data.id as number, name: c.name, city: c.city, lat: c.lat, lng: c.lng });
      added++;
    }
  }
  console.log(apply
    ? `\n${added} drafts inserted. Next: npm run verify (Wikidata-only sources go to needs_review until re-sourced).`
    : "\nPrinted only. Run with --apply to insert the new candidates as draft.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
