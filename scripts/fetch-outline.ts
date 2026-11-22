// Stores a large landmark's OSM outline (cemetery, park) as its check-in area, and makes it check-in
// grade. Only for places a person has decided count as a landmark. The geocoder result must name the
// place (name or alias) in the right city. Dry run by default.
// Usage: npm run fetch-outline -- --id 4 [--apply]
import { config } from "dotenv";
import { haversineKm, parseOutline } from "../lib/distance";
import { supabaseAdmin } from "../lib/supabase";
import { contactOrThrow } from "../lib/verify/run";
import { classifyAny, namesAny } from "../lib/verify/upgrade";

config({ path: ".env.local", quiet: true });
const arg = (n: string) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };
const MAX_CHARS = 50_000; // same limit as the column check in migration 013

async function main() {
  const id = Number(arg("--id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Pass --id <location id>");
  const apply = process.argv.includes("--apply");
  const contact = contactOrThrow();
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("locations")
    .select("id, name, aliases, city, lat, lng, coord_quality, geocode_query, verification_status").eq("id", id).single();
  if (error) throw new Error(`${error.message} (is migration 013 applied?)`);

  // Simplified to about 5 m so the outline stays small enough to send to phones.
  const params = new URLSearchParams({
    q: row.geocode_query ?? [row.name, row.city, "Germany"].filter(Boolean).join(", "),
    format: "jsonv2", limit: "1", countrycodes: "de", addressdetails: "1", polygon_geojson: "1", polygon_threshold: "0.00005",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": `ScreenPassport/0.1 (${contact})` } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hit = (await res.json())[0];
  if (!hit) throw new Error("No geocoder result.");
  const geo = classifyAny(hit, [row.name, ...(row.aliases ?? [])], row.city);
  const outline = parseOutline(hit.geojson);
  const names = [row.name, ...(row.aliases ?? [])];
  const problems = [
    !namesAny(hit.name ?? "", names, row.city) && `geocoder name “${hit.name}” doesn't match`,
    !geo.cityMatch && "city doesn't match",
    geo.kind === "residential" && "possible private home",
    !outline && `no outline (got ${hit.geojson?.type ?? "nothing"})`,
    outline && JSON.stringify(outline).length > MAX_CHARS && "outline too large",
  ].filter(Boolean);
  const point = { lat: Number(hit.lat), lng: Number(hit.lon) };
  const moved = Math.round(haversineKm({ lat: row.lat, lng: row.lng }, point) * 1000);
  console.log(`#${row.id} ${row.name}: ${row.coord_quality} → ${problems.length ? row.coord_quality : "geocoded_poi"}; ${hit.name} (${hit.category}/${hit.type}, osm ${hit.osm_type} ${hit.osm_id}); outline ${outline?.type ?? "none"}, ${JSON.stringify(outline ?? "").length} chars; pin moves ${moved} m`);
  if (problems.length) {
    console.log(`Not changed: ${problems.join("; ")}`);
    return;
  }
  if (!apply) return console.log("Dry run. Add --apply to save.");

  const { error: upErr } = await db.from("locations").update({
    check_in_area: outline, lat: point.lat, lng: point.lng, coord_quality: "geocoded_poi",
    bbox_south: null, bbox_west: null, bbox_north: null, bbox_east: null, // the outline replaces the box
  }).eq("id", row.id);
  if (upErr) throw new Error(upErr.message);
  const { error: logErr } = await db.from("location_reviews").insert({
    location_id: row.id, method: "team", decision: "published",
    reasons: ["team decided this site counts as a landmark: check-in anywhere inside its OSM outline"],
    geocode: { name: hit.name, category: hit.category, type: hit.type, display_name: hit.display_name, osm: `${hit.osm_type}/${hit.osm_id}`, kind: geo.kind,
      old: { lat: row.lat, lng: row.lng, coord_quality: row.coord_quality }, distance_m: moved },
  });
  if (logErr) throw new Error(`review log: ${logErr.message}`);
  console.log("Saved.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
