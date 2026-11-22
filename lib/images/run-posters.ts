// Finds free-licensed posters on Wikimedia Commons for works. Used by scripts/fetch-posters.ts.
// Server only. Order: Wikidata P3383 (film poster) on the title's item, then Commons search
// "<title> <year> poster". Claude confirms each candidate; only a confirmed poster is stored.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseTitle } from "../match";
import { BudgetExhausted } from "../pipeline/ai";
import { searchItems, sparql } from "../pipeline/sources-net";
import { pickWorkItem, toWorkItem, workTypesQuery } from "../wikidata";
import { byPosterSearch, byTitles, type Candidate, p18File, toCandidate } from "./commons";
import { askPosterMatch } from "./poster-check";
import { ImageFetchError } from "./relevance";
import { getJson, pages } from "./run";

const MAX_AI_CHECKS = 3;

type Row = { id: string; title: string; aliases: string[]; type: "film" | "series"; year: number | null; wikidata_id: string | null };

/** The work's Wikidata item: stored, else one clear match by title or alias, type and year (never a guess). */
async function itemOf(row: Row): Promise<string | null> {
  if (row.wikidata_id) return row.wikidata_id;
  const hits = [...new Set([...(await searchItems(row.title)), ...(row.aliases[0] ? await searchItems(row.aliases[0]) : [])])];
  if (!hits.length) return null;
  const picked = pickWorkItem(row, (await sparql(workTypesQuery(hits))).map(toWorkItem), normaliseTitle);
  return "qid" in picked ? picked.qid : null;
}
export type PosterSummary = { checked: number; found: number; none: number; lines: string[] };
export type PosterOptions = { ids?: string[]; limit?: number; dryRun?: boolean; retry?: boolean; log?: (s: string) => void };

async function p3383(qid: string): Promise<string[]> {
  const r = await getJson<{ claims?: { P3383?: { mainsnak: { datavalue?: { value: string } } }[] } }>(
    "https://www.wikidata.org/w/api.php", { action: "wbgetclaims", entity: qid, property: "P3383", format: "json" });
  return (r.claims?.P3383 ?? []).flatMap((c) => (c.mainsnak.datavalue ? [p18File(c.mainsnak.datavalue.value)] : []));
}

async function candidates(row: Row): Promise<{ list: Candidate[]; skipped: string[] }> {
  const list: Candidate[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const add = (ps: Awaited<ReturnType<typeof pages>>) => {
    for (const p of ps) {
      if (seen.has(p.title)) continue;
      seen.add(p.title);
      const c = toCandidate(p, "poster");
      if ("skip" in c) skipped.push(`${p.title}: ${c.skip}`);
      else list.push(c);
    }
  };
  if (row.wikidata_id) {
    const files = await p3383(row.wikidata_id);
    if (files.length) add(await pages(byTitles(files)));
  }
  if (list.length === 0) add(await pages(byPosterSearch(row.title, row.year)));
  return { list, skipped };
}

const fields = (c: Candidate, reason: string) => ({
  poster_url: c.url, poster_thumb_url: c.thumbUrl, poster_author: c.author, poster_license: c.license,
  poster_license_url: c.licenseUrl, poster_page: c.sourcePage, poster_status: "auto", poster_check_reason: reason.slice(0, 300),
});

export async function runPosters(db: SupabaseClient, o: PosterOptions = {}): Promise<PosterSummary> {
  const log = o.log ?? (() => {});
  let q = db.from("works").select("id, title, aliases, type, year, wikidata_id").order("id");
  // A dry run works before migration 017; a real run skips works already looked at.
  if (!o.dryRun) q = o.retry ? q.or("poster_status.is.null,poster_status.eq.none") : q.is("poster_status", null);
  if (o.ids?.length) q = q.in("id", o.ids);
  const { data, error } = await q.limit(o.limit ?? 200);
  if (error) throw new Error(`${error.message} (is migration 017 applied?)`);

  const s: PosterSummary = { checked: 0, found: 0, none: 0, lines: [] };
  for (const row of data as Row[]) {
    if (s.checked) await new Promise((r) => setTimeout(r, 1500)); // gentle on Wikidata search
    s.checked++;
    const qid = await itemOf(row);
    const { list, skipped } = await candidates({ ...row, wikidata_id: qid });
    log(`  ${row.id}: Wikidata ${qid ?? "no clear item"}`);
    for (const k of skipped.slice(0, 3)) log(`  ${row.id} skip ${k}`);
    let chosen: { c: Candidate; reason: string } | null = null;
    for (const c of list.slice(0, MAX_AI_CHECKS)) {
      try {
        const m = await askPosterMatch(c.thumbUrl, row);
        log(`  ${row.id} ${c.file} (${c.license}): ${m ? `${m.matches ? "match" : "no match"}: ${m.reason}` : "AI answer invalid"}`);
        if (m?.matches) { chosen = { c, reason: m.reason }; break; }
      } catch (e) {
        if (e instanceof BudgetExhausted) throw e;
        if (e instanceof ImageFetchError) { log(`  ${row.id} ${c.file}: ${e.message}`); continue; }
        throw e;
      }
    }
    if (chosen) s.found++; else s.none++;
    s.lines.push(`${row.id} (${row.title}): ${chosen ? `poster ${chosen.c.file}, ${chosen.c.license}` : list.length ? "no candidate confirmed" : "no free poster on Commons"}`);
    log(s.lines.at(-1)!);
    if (!o.dryRun) {
      const patch = { ...(chosen ? fields(chosen.c, chosen.reason) : { poster_status: "none" }), ...(qid && !row.wikidata_id ? { wikidata_id: qid } : {}) };
      const { error: upErr } = await db.from("works").update(patch).eq("id", row.id);
      if (upErr) throw new Error(`${row.id}: ${upErr.message}`);
    }
  }
  return s;
}
