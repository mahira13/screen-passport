// Loads data/seed/*.csv into Supabase. Safe to re-run (upserts by id; location_works by
// location and title). Never publishes: new places arrive as draft, existing ones keep their
// verification status and checked coordinates, places merged away are left alone.
// Usage: npm run seed            (writes to Supabase)
//        npm run seed -- --dry-run (parse + validate only)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { supabaseAdmin } from "../lib/supabase";
import { type DbLocation, mergeWork, planLocationRow, toCollection, toLocation, toLocationWork, toWork, validateSeed } from "./seed-rows";

config({ path: ".env.local" });

const SEED_DIR = join(process.cwd(), "data", "seed");

function readCsv(file: string): Record<string, string>[] {
  return parse(readFileSync(join(SEED_DIR, file), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const works = readCsv("titles.csv").map(toWork);
  const locations = readCsv("locations.csv").map(toLocation);
  const collections = readCsv("collections.csv").map(toCollection);
  const links = existsSync(join(SEED_DIR, "location_works.csv")) ? readCsv("location_works.csv").map(toLocationWork) : [];

  const problems = validateSeed(works, locations, collections, links);
  if (problems.length) {
    console.error("Seed has problems:\n- " + problems.join("\n- "));
    process.exit(1);
  }

  const missing = locations.filter((l) => l.lat === null).length;
  console.log(
    `Parsed ${works.length} works, ${locations.length} locations (${missing} need geocoding), ${collections.length} collections, ${links.length} extra title links.`,
  );
  if (dryRun) return console.log("Dry run: nothing written.");

  const db = supabaseAdmin();

  // Don't undo review work: keep verification, coordinates and catalogue fields already in the database.
  const { data: existing, error: readErr } = await db
    .from("locations")
    .select("id, lat, lng, coord_quality, status, verification_status, merged_into, country, country_code, location_confidence, public_access, is_filming_location");
  if (readErr) throw new Error(`${readErr.message} (run migrations 007 and 008 first)`);
  const known = new Map((existing as DbLocation[]).map((e) => [e.id, e]));
  const rows = locations.flatMap((l) => planLocationRow(l, known.get(l.id)) ?? []);
  const skipped = locations.length - rows.length;
  const added = rows.filter((r) => !known.has(r.id)).length;

  const { data: dbWorks, error: worksErr } = await db.from("works").select("id, year, aliases");
  if (worksErr) throw worksErr;
  const knownWorks = new Map(dbWorks.map((w) => [w.id as string, w]));

  const step = async (table: string, data: object[]) => {
    const { error } = await db.from(table).upsert(data, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${data.length} rows`);
  };
  await step("works", works.map((w) => mergeWork(w, knownWorks.get(w.id))));
  await step("locations", rows);
  if (links.length) {
    const { error } = await db.from("location_works").upsert(links, { onConflict: "location_id,work_id" });
    if (error) throw new Error(`location_works: ${error.message}`);
    console.log(`  location_works: ${links.length} rows`);
  }
  await step("collections", collections);
  console.log(`  ${added} new places as draft, ${skipped} merged places left alone.`);

  const { error: seqErr } = await db.rpc("sync_locations_id_seq");
  if (seqErr) throw new Error(`sync_locations_id_seq: ${seqErr.message}`);

  console.log("Seed import done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
