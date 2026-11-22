// Saves the tables that migration 007 and merges touch as JSON, before you change the database.
// Usage: npm run backup   -> backups/<timestamp>/<table>.json (folder is git-ignored; keep it private:
// passports and trips include hashed keys and first names).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const TABLES = ["works", "locations", "collections", "passports", "trips", "trip_joins", "requests"];
const PAGE = 1000;

async function main() {
  const db = supabaseAdmin();
  const dir = join(process.cwd(), "backups", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select("*").order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`  ${table}: ${rows.length} rows`);
  }
  console.log(`Saved to ${dir}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
