// Fills release year and German/English alternative titles for works from TMDB.
// Metadata only: no filming locations, posters or images from TMDB. Credit is in the footer.
// Needs TMDB_READ_TOKEN (API read access token) or TMDB_API_KEY in .env.local.
// Usage: npm run tmdb                               (print what would change)
//        npm run tmdb -- --works dark,unorthodox    (just these)
//        npm run tmdb -- --id unknown-2011=movie:48138 (when a title is ambiguous)
//        npm run tmdb -- --apply [--force-year]     (write; years are only filled when empty)
import { config } from "dotenv";
import { normaliseTitle } from "../lib/match";
import { supabaseAdmin } from "../lib/supabase";
import { type Details, metadataUpdate, pickHit, type SearchHit } from "../lib/tmdb";
import type { Work } from "../lib/types";

config({ path: ".env.local" });

const API = "https://api.themoviedb.org/3";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const args = (name: string) => process.argv.flatMap((a, i) => (process.argv[i - 1] === name ? [a] : []));

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) throw new Error("Set TMDB_READ_TOKEN or TMDB_API_KEY in .env.local (free at themoviedb.org/settings/api).");
  const q = new URLSearchParams({ ...params, ...(token ? {} : { api_key: key! }) });
  const res = await fetch(`${API}${path}?${q}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return tmdb(path, params);
  }
  if (!res.ok) throw new Error(`TMDB ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function find(work: Work, overrides: Map<string, string>): Promise<{ kind: "movie" | "tv"; id: number } | null> {
  const fixed = overrides.get(work.id)?.match(/^(movie|tv):(\d+)$/);
  if (fixed) return { kind: fixed[1] as "movie" | "tv", id: Number(fixed[2]) };
  const kind = work.type === "film" ? "movie" : "tv";
  const yearParam = work.year ? { [kind === "movie" ? "year" : "first_air_date_year"]: String(work.year) } : {};
  const hits = (await tmdb<{ results: SearchHit[] }>(`/search/${kind}`, { query: work.title, include_adult: "false", ...yearParam })).results;
  const picked = pickHit(work, hits, normaliseTitle);
  if ("hit" in picked) return { kind, id: picked.hit.id };
  const list = picked.ambiguous.slice(0, 5).map((h) => `${kind}:${h.id} (${h.title ?? h.name}, ${(h.release_date ?? h.first_air_date ?? "?").slice(0, 4)})`).join(", ");
  console.log(`  ${work.id}: ${picked.ambiguous.length ? `ambiguous: ${list}` : "not found"}. Pass --id ${work.id}=${kind}:…`);
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force-year");
  const only = arg("--works")?.split(",");
  const overrides = new Map(args("--id").map((s) => s.split("=") as [string, string]));
  const db = supabaseAdmin();
  const { data, error } = await db.from("works").select("id, title, type, aliases, year").order("id");
  if (error) throw error;

  let changed = 0;
  for (const work of (data as Work[]).filter((w) => !only || only.includes(w.id))) {
    const found = await find(work, overrides);
    if (!found) continue;
    const d = await tmdb<Details>(`/${found.kind}/${found.id}`, { append_to_response: "alternative_titles,translations" });
    const u = metadataUpdate(work, d, force);
    const yearNote = u.year !== work.year ? `year ${work.year ?? "–"} → ${u.year}` : `year ${work.year ?? "–"}`;
    console.log(`${work.title} (${found.kind}:${found.id}): ${yearNote}; ${u.added.length ? `adds ${u.added.join(" | ")}` : "no new aliases"}`);
    if (u.year === work.year && !u.added.length) continue;
    changed++;
    if (!apply) continue;
    const { error: upErr } = await db.from("works").update({ year: u.year, aliases: u.aliases }).eq("id", work.id);
    if (upErr) console.log(`  not saved: ${upErr.message}`);
  }
  console.log(apply ? `\n${changed} works updated.` : `\n${changed} works would change. Run with --apply to save.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
