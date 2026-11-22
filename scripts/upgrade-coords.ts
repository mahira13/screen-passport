// Upgrades approximate pins of one title's published places to geocoded_poi where the evidence allows
// (rules in lib/verify/upgrade.ts). Dry run by default; --apply writes the new pin, its outline and a
// review-log entry with the source URL and quote. Never touches places that don't qualify.
// Usage: npm run upgrade-coords -- --work dark [--apply] [--skip 12,34]
import { REGION } from "../lib/region";
import { config } from "dotenv";
import { canCheckIn } from "../lib/distance";
import { supabaseAdmin } from "../lib/supabase";
import { isTrustedSource } from "../lib/trusted-sources";
import { fetchPage } from "../lib/verify/fetch-page";
import { contactOrThrow, geocode } from "../lib/verify/run";
import { extractText } from "../lib/verify/text";
import { classifyAny, decideUpgrade, findPlaceQuote } from "../lib/verify/upgrade";

config({ path: ".env.local", quiet: true });
const arg = (n: string) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };

type Row = {
  id: number; name: string; aliases?: string[]; city: string | null; lat: number; lng: number; coord_quality: string | null;
  source_url: string; geocode_query: string | null; verification_status: string;
  location_works: { work_id: string; scene_note: string | null; evidence_url: string | null }[];
};

async function main() {
  const work = arg("--work");
  if (!work) throw new Error("Pass --work <id>, e.g. --work dark");
  const apply = process.argv.includes("--apply");
  const skip = new Set((arg("--skip") ?? "").split(",").filter(Boolean).map(Number)); // left as they are, e.g. after a manual look
  const contact = contactOrThrow();
  const db = supabaseAdmin();
  const query = (cols: string) => {
    const select: string = `id, name, city, lat, lng, coord_quality, source_url, geocode_query, verification_status, ${cols}location_works!inner(work_id, scene_note, evidence_url)`;
    return db.from("locations").select(select)
      .eq("verification_status", "published").is("merged_into", null).eq("location_works.work_id", work).order("id");
  };
  let { data, error } = await query("aliases, ");
  if (error?.code === "42703" || error?.code === "PGRST204") ({ data, error } = await query("")); // before migration 013
  if (error) throw new Error(error.message);
  // The inner filter keeps only this title's link; read all links for the studio/home check.
  const rows = data as unknown as Row[];
  const ids = rows.map((r) => r.id);
  const { data: links } = await db.from("location_works").select("location_id, scene_note").in("location_id", ids);

  console.log(`| Location | Before → after | Source | Old → new pin | Notes |\n|---|---|---|---|---|`);
  let upgraded = 0;
  let grade = 0;
  for (const row of rows) {
    if (skip.has(row.id)) {
      console.log(`| ${row.name} | ${row.coord_quality} (skipped) | | | |`);
      continue;
    }
    if (canCheckIn({ lat: row.lat, lng: row.lng, coord_quality: row.coord_quality as never })) {
      grade++;
      console.log(`| ${row.name} | ${row.coord_quality} (already check-in grade) | | | |`);
      continue;
    }
    const url = row.location_works[0].evidence_url ?? row.source_url;
    const page = await fetchPage(url, contact);
    const text = page.ok ? extractText(page.html) : "";
    const quote = page.ok ? findPlaceQuote(text, [row.name, ...(row.aliases ?? [])], row.city) : null;
    const hit = await geocode(db, row.geocode_query ?? [row.name, row.city, REGION.country].filter(Boolean).join(", "), contact).catch(() => null);
    const geo = hit ? classifyAny(hit, [row.name, ...(row.aliases ?? [])], row.city) : null;
    const notes = (links ?? []).filter((l) => l.location_id === row.id).map((l) => l.scene_note ?? "");
    const u = decideUpgrade({ name: row.name, aliases: row.aliases, city: row.city, old: { lat: row.lat, lng: row.lng }, trusted: isTrustedSource(page.ok ? page.url : url), quote, hit, geo, sceneNotes: notes });

    const after = u.upgrade ? "geocoded_poi" : row.coord_quality;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const extra = [
      !page.ok && `source unreachable (${page.reason})`,
      quote && `quote: “${quote}”`,
      hit && `geocoder: ${hit.name ?? "?"} (${hit.category}/${hit.type})`,
      ...u.reasons,
      u.removeFromChallenge && "FLAG: remove from challenge",
    ].filter(Boolean).join("; ");
    console.log(`| ${row.name} | ${row.coord_quality} → ${after} | ${host} | ${u.distanceM ?? "–"} m | ${extra} |`);

    if (u.upgrade) upgraded++;
    if (u.upgrade && apply) {
      const [s, w, n, e] = geo!.bbox ?? [null, null, null, null];
      const { error: upErr } = await db.from("locations").update({
        lat: u.newPoint!.lat, lng: u.newPoint!.lng, coord_quality: "geocoded_poi",
        bbox_south: s, bbox_west: w, bbox_north: n, bbox_east: e,
      }).eq("id", row.id);
      if (upErr) throw new Error(`#${row.id}: ${upErr.message}`);
      const { error: logErr } = await db.from("location_reviews").insert({
        location_id: row.id, work_id: work, method: "team", decision: "published",
        reasons: ["coordinates upgraded to geocoded_poi (trusted source names the place; Nominatim landmark agrees with the old pin)"],
        evidence_url: page.ok ? page.url : url, evidence_quote: quote!.slice(0, 300),
        geocode: { name: hit!.name, category: hit!.category, type: hit!.type, display_name: hit!.display_name, kind: geo!.kind,
          old: { lat: row.lat, lng: row.lng, coord_quality: row.coord_quality }, distance_m: u.distanceM },
      });
      if (logErr) throw new Error(`review log #${row.id}: ${logErr.message}`);
    }
  }
  console.log(`\n${apply ? "Upgraded" : "Would upgrade"} ${upgraded}. Check-in grade ${apply ? "now" : "after"}: ${grade + upgraded} of ${rows.length}.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
