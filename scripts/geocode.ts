// Fills empty lat/lng from each location's geocode_query with OpenStreetMap
// Nominatim, one request per second. Results that are only a district,
// suburb, city or road are flagged and not saved: fix those by hand in
// /admin/locations. Nothing here ever sets coord_quality = 'verified'.
// Usage: npm run geocode              (saves precise results as 'geocoded')
//        npm run geocode -- --dry-run (prints results, saves nothing)
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
import { config } from "dotenv";
import { isCoarse, placeType, type NominatimHit } from "../lib/geocode";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1000; // Nominatim allows at most one request per second
// An email or URL so Nominatim can reach us; required by their policy.
const contact = process.env.GEOCODER_CONTACT || process.env.GEOCODE_CONTACT;
const USER_AGENT = `ScreenPassport/0.1 (${contact ?? "contact not set"})`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(q: string): Promise<NominatimHit | null> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "de" });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de,en" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${q}"`);
  const hits = (await res.json()) as NominatimHit[];
  return hits[0] ?? null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!contact) {
    console.error("Set GEOCODER_CONTACT (your email or project URL) in .env.local first.");
    process.exit(1);
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("locations")
    .select("id, name, geocode_query")
    .or("lat.is.null,lng.is.null")
    .order("id");
  if (error) throw error;
  console.log(`${data.length} locations without coordinates.${dryRun ? " Dry run: nothing is saved." : ""}\n`);

  const flagged: string[] = [];
  const missing: string[] = [];
  let saved = 0;
  let requests = 0;

  for (const loc of data) {
    const label = `#${loc.id} ${loc.name}`;
    if (!loc.geocode_query) {
      missing.push(`${label}: no geocode_query`);
      continue;
    }
    if (requests++ > 0) await sleep(DELAY_MS);
    const hit = await lookup(loc.geocode_query);
    if (!hit) {
      missing.push(`${label}: no result for "${loc.geocode_query}"`);
      console.log(`  ✗  ${label}\n     no result for "${loc.geocode_query}"`);
      continue;
    }
    const coarse = isCoarse(hit);
    console.log(
      `  ${coarse ? "⚠ " : "✓ "} ${label}\n` +
        `     ${placeType(hit)} · ${hit.lat}, ${hit.lon}\n` +
        `     ${hit.display_name}`,
    );
    if (coarse) {
      flagged.push(`${label}: ${placeType(hit)}`);
      continue;
    }
    if (dryRun) continue;
    const { error: upErr } = await db
      .from("locations")
      .update({ lat: Number(hit.lat), lng: Number(hit.lon), coord_quality: "geocoded" })
      .eq("id", loc.id)
      .is("lat", null);
    if (upErr) throw upErr;
    saved++;
  }

  console.log(`\n${dryRun ? "Would save" : "Saved"} ${dryRun ? data.length - flagged.length - missing.length : saved} of ${data.length}.`);
  if (flagged.length) {
    console.log(`\nFlagged, not saved (area or road, fix by hand in /admin/locations):\n- ${flagged.join("\n- ")}`);
  }
  if (missing.length) console.log(`\nNot found:\n- ${missing.join("\n- ")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
