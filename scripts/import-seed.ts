// Loads data/seed/*.csv into Supabase. Safe to re-run (upserts by id).
// Usage: npm run seed            (writes to Supabase)
//        npm run seed -- --dry-run (parse + validate only)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { supabaseAdmin } from "../lib/supabase";
import { toCollection, toLocation, toWork, validateSeed } from "./seed-rows";

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

  const problems = validateSeed(works, locations, collections);
  if (problems.length) {
    console.error("Seed has problems:\n- " + problems.join("\n- "));
    process.exit(1);
  }

  const missing = locations.filter((l) => l.lat === null).length;
  console.log(
    `Parsed ${works.length} works, ${locations.length} locations (${missing} need geocoding), ${collections.length} collections.`,
  );
  if (dryRun) return console.log("Dry run: nothing written.");

  const db = supabaseAdmin();

  // Don't wipe coordinates that `npm run geocode` (or a human) already filled in.
  const { data: existing, error: readErr } = await db
    .from("locations")
    .select("id, lat, lng, coord_quality")
    .not("lat", "is", null);
  if (readErr) throw readErr;
  const known = new Map(existing.map((e) => [e.id as number, e]));
  const rows = locations.map((l) => {
    const prev = known.get(l.id);
    return l.lat === null && prev
      ? { ...l, lat: prev.lat, lng: prev.lng, coord_quality: prev.coord_quality }
      : l;
  });

  const step = async (table: string, data: object[]) => {
    const { error } = await db.from(table).upsert(data, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${data.length} rows`);
  };
  await step("works", works);
  await step("locations", rows);
  await step("collections", collections);

  const { error: seqErr } = await db.rpc("sync_locations_id_seq");
  if (seqErr) throw new Error(`sync_locations_id_seq: ${seqErr.message}`);

  console.log("Seed import done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
