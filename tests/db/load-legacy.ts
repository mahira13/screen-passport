// Loads the seed CSVs into the pre-007 schema, the way the live project has them:
// rows with coordinates are live, the rest unverified. Plus a trip and a passport that
// point at a duplicate, so the merge test can check they are remapped.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { Client } from "pg";
import { toLocation, toWork } from "../../scripts/seed-rows";

const read = (f: string): Record<string, string>[] =>
  parse(readFileSync(join(process.cwd(), "data", "seed", f), "utf8"), { columns: true, trim: true, bom: true });

async function main() {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  for (const w of read("titles.csv").map(toWork)) {
    await db.query("insert into works (id, title, type, aliases, year) values ($1,$2,$3,$4,$5)", [w.id, w.title, w.type, w.aliases, w.year]);
  }
  for (const l of read("locations.csv").map(toLocation)) {
    await db.query(
      `insert into locations (id, work_id, name, scene_note, address, city, region, lat, lng, coord_quality,
         visit_note, source_name, source_url, status, geocode_query)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [l.id, l.work_id, l.name, l.scene_note, l.address, l.city, l.region, l.lat, l.lng, l.coord_quality,
        l.visit_note, l.source_name, l.source_url, l.lat === null ? "unverified" : "live", l.geocode_query],
    );
  }
  await db.query(
    `insert into trips (id, title, work_ids, start_label, start_lat, start_lng, mode, length, starts_at,
       meeting_point, organiser_name, plan)
     values ('trip-merge-test', 'Test', '{atomic-blonde}', 'Berlin', 52.52, 13.405, 'walk', 'half', now(),
       'Alexanderplatz', 'Ana', '{"stops":[{"location_id":55},{"location_id":56}],"tips":[]}')`,
  );
  await db.query("insert into passports (id, watched, visited) values ('passport-merge-test', '{}', '{55,32,56}')");
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
