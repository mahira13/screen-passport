// Writes the hand-made collections from published data (rules in lib/curate.ts). Dry run by default.
// A collection that doesn't meet its minimum is written unpublished. Hand-picked collections need
// migration 018; before it, they are printed and skipped.
// Usage: npm run curate [-- --apply]
import { config } from "dotenv";
import { cityCount, pickPlaces, type Candidate, type PickRules } from "../lib/curate";
import { canCheckIn } from "../lib/distance";
import { supabaseAdmin } from "../lib/supabase";
import { isPlaceholderTitle } from "../lib/work-title";

config({ path: ".env.local", quiet: true });

type Spec = { id: string; name: string; city: string | null; description: string } & (
  | { kind: "title"; workId: string }
  | { kind: "picked"; filter: (c: Candidate) => boolean; rules: PickRules; publishIf: (p: Candidate[]) => boolean; need: string }
);

const SPECS: Spec[] = [
  { kind: "title", id: "dark-in-germany", name: "Dark in Germany", city: null, workId: "dark",
    description: "Every published filming place of Dark, the German series set in the fictional town of Winden." },
  { kind: "picked", id: "berlin-through-cinema", name: "Berlin Through Cinema", city: "Berlin",
    description: "Berlin on screen: up to two places from each film and series, ones you can check in at first.",
    filter: (c) => c.city === "Berlin", rules: { max: 20, perTitle: 2 }, publishIf: (p) => p.length >= 15, need: "15–20 places" },
  { kind: "picked", id: "cinematic-germany", name: "Cinematic Germany", city: null,
    description: "Twelve filming places across Germany you can check in at, one per film or series.",
    filter: (c) => c.checkIn, rules: { max: 12, perTitle: 1, spreadCities: true },
    publishIf: (p) => p.length === 12 && cityCount(p) >= 4, need: "12 check-in places in 4+ cities" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const db = supabaseAdmin();
  const [entries, works, probe] = await Promise.all([
    db.from("catalogue_entries").select("id, work_id, name, city, lat, lng, coord_quality, image_thumb_url, image_source_page"),
    db.from("works").select("id, title"),
    db.from("collections").select("id, published").limit(1),
  ]);
  if (entries.error || works.error) throw new Error((entries.error ?? works.error)!.message);
  const has018 = !probe.error;
  const named = new Set(works.data.filter((w) => !isPlaceholderTitle(w.title)).map((w) => w.id));

  const byId = new Map<number, Candidate & { name: string }>();
  for (const e of entries.data) {
    if (e.lat == null || e.lng == null || !named.has(e.work_id)) continue;
    const c = byId.get(e.id) ?? { id: e.id, name: e.name, city: e.city, works: [] as string[], photo: !!(e.image_thumb_url && e.image_source_page), checkIn: canCheckIn(e) };
    c.works.push(e.work_id);
    byId.set(e.id, c);
  }
  const all = [...byId.values()];

  for (const s of SPECS) {
    let row: Record<string, unknown>;
    let picks: Candidate[] = [];
    if (s.kind === "title") {
      const places = all.filter((c) => c.works.includes(s.workId));
      console.log(`${s.name}: ${places.length} places, ${places.filter((c) => c.checkIn).length} check-in grade`);
      row = { id: s.id, name: s.name, city: s.city, work_ids: [s.workId], description: s.description, ...(has018 && { published: true }) };
    } else {
      picks = pickPlaces(all.filter(s.filter), s.rules);
      const ok = s.publishIf(picks);
      console.log(`${s.name}: ${picks.length} places in ${cityCount(picks)} cities, ${picks.filter((c) => c.checkIn).length} check-in grade → ${ok ? "published" : `unpublished (needs ${s.need})`}`);
      for (const p of picks) console.log(`   #${p.id} ${byId.get(p.id)!.name} (${p.city}; ${p.works.join(", ")}${p.checkIn ? "; check-in" : ""}${p.photo ? "; photo" : ""})`);
      if (!has018) { console.log("   skipped: run migration 018 first"); continue; }
      row = { id: s.id, name: s.name, city: s.city, work_ids: [...new Set(picks.flatMap((p) => p.works))], description: s.description, published: ok };
    }
    if (!apply) continue;
    const { error } = await db.from("collections").upsert(row, { onConflict: "id" });
    if (error) throw new Error(`${s.id}: ${error.message}`);
    if (s.kind === "picked") {
      const del = await db.from("collection_items").delete().eq("collection_id", s.id);
      if (del.error) throw new Error(`${s.id} items: ${del.error.message}`);
      const ins = await db.from("collection_items").insert(picks.map((p, i) => ({ collection_id: s.id, location_id: p.id, position: i + 1 })));
      if (ins.error) throw new Error(`${s.id} items: ${ins.error.message}`);
    }
  }
  console.log(apply ? "\nSaved." : "\nDry run. Add --apply to save.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
