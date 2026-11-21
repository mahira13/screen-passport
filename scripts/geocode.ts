// Fills empty lat/lng with OpenStreetMap Nominatim, one request per second.
// Usage: npm run geocode            (writes to Supabase)
//        npm run geocode -- --dry-run (look up and print only)
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
import { config } from "dotenv";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1100;
const contact = process.env.GEOCODE_CONTACT; // an email or URL, required by the policy
const USER_AGENT = `ScreenPassport/0.1 (${contact ?? "set GEOCODE_CONTACT in .env.local"})`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${ENDPOINT}?${new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "de" })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "de,en" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${q}"`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return hits[0] ? { lat: Number(hits[0].lat), lng: Number(hits[0].lon), label: hits[0].display_name } : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!contact && !dryRun) {
    console.error("Set GEOCODE_CONTACT (your email or project URL) in .env.local first.");
    process.exit(1);
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("locations")
    .select("id, name, address, city")
    .or("lat.is.null,lng.is.null")
    .order("id");
  if (error) throw error;
  console.log(`${data.length} locations without coordinates.`);

  let filled = 0;
  for (const [i, loc] of data.entries()) {
    if (i > 0) await sleep(DELAY_MS);
    const q = [loc.address, loc.city].filter(Boolean).join(", ");
    const hit = await lookup(q);
    if (!hit) {
      console.log(`  #${loc.id} ${loc.name}: no result for "${q}"`);
      continue;
    }
    console.log(`  #${loc.id} ${loc.name}: ${hit.lat}, ${hit.lng}  (${hit.label})`);
    if (dryRun) continue;
    const { error: upErr } = await db
      .from("locations")
      .update({ lat: hit.lat, lng: hit.lng, coord_quality: "geocoded" })
      .eq("id", loc.id);
    if (upErr) throw upErr;
    filled++;
  }
  console.log(dryRun ? "Dry run: nothing written." : `Filled ${filled} of ${data.length}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
