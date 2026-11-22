// Finds Commons photos for published locations. Used by scripts/fetch-images.ts and the admin page.
// Server only (service role key). Order: Wikidata P18, Commons search by name + city, geosearch 100 m.
import { BudgetExhausted } from "../pipeline/ai";
import { geocoderContact } from "../geocode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { byGeo, bySearch, byTitles, type Candidate, COMMONS_API, type CommonsPage, p18File, toCandidate } from "./commons";
import { askImageMatch, ImageFetchError } from "./relevance";

const GAP_MS = 1000; // one Commons/Wikidata request per second
const MAX_AI_CHECKS = 3; // candidates shown to Claude per place

type Row = {
  id: number; name: string; city: string | null; lat: number | null; lng: number | null;
  scene_note: string | null; wikidata_id: string | null; image_skip: string[];
};
export type ImageSummary = { found: number; auto: number; review: number; none: number; lines: string[] };
export type ImageOptions = { ids?: number[]; limit?: number; dryRun?: boolean; log?: (s: string) => void };

let last = 0;
export async function getJson<T>(base: string, params: Record<string, string>): Promise<T> {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const contact = geocoderContact();
  if (!contact) throw new Error("Set GEOCODER_CONTACT for the Wikimedia User-Agent.");
  const res = await fetch(`${base}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": `ScreenPassport/0.1 (${contact})` },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429 || res.status === 503) throw new Error(`Wikimedia busy (HTTP ${res.status}); try again later`);
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const pages = async (params: Record<string, string>) =>
  ((await getJson<{ query?: { pages?: CommonsPage[] } }>(COMMONS_API, params)).query?.pages ?? []);

async function p18(qid: string): Promise<string[]> {
  const r = await getJson<{ claims?: { P18?: { mainsnak: { datavalue?: { value: string } } }[] } }>(
    "https://www.wikidata.org/w/api.php", { action: "wbgetclaims", entity: qid, property: "P18", format: "json" });
  return (r.claims?.P18 ?? []).flatMap((c) => (c.mainsnak.datavalue ? [p18File(c.mainsnak.datavalue.value)] : []));
}

async function candidates(row: Row): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const seen = new Set(row.image_skip);
  const add = (ps: CommonsPage[]) => {
    for (const p of ps) {
      if (seen.has(p.title)) continue;
      seen.add(p.title);
      const c = toCandidate(p);
      if (!("skip" in c)) out.push(c);
    }
  };
  if (row.wikidata_id) {
    const files = await p18(row.wikidata_id);
    if (files.length) add(await pages(byTitles(files)));
  }
  if (out.length < MAX_AI_CHECKS) add(await pages(bySearch(row.name, row.city)));
  if (out.length < MAX_AI_CHECKS && row.lat !== null && row.lng !== null) add(await pages(byGeo(row.lat, row.lng)));
  return out;
}

const fields = (c: Candidate, status: "auto" | null, reason: string) => ({
  image_url: c.url, image_thumb_url: c.thumbUrl, image_author: c.author, image_license: c.license,
  image_license_url: c.licenseUrl, image_source_page: c.sourcePage, image_status: status,
  image_check_reason: reason.slice(0, 300) || null,
});
export const NO_IMAGE = {
  image_url: null, image_thumb_url: null, image_author: null, image_license: null,
  image_license_url: null, image_source_page: null, image_status: null, image_check_reason: null,
};

export async function runImages(db: SupabaseClient, o: ImageOptions = {}): Promise<ImageSummary> {
  const log = o.log ?? (() => {});
  let q = db.from("locations").select("id, name, city, lat, lng, scene_note, wikidata_id, image_skip")
    .eq("verification_status", "published").is("merged_into", null).is("image_url", null).is("image_status", null).order("id"); // rejected: wait for "Find another"
  if (o.ids?.length) q = q.in("id", o.ids);
  const { data, error } = await q.limit(o.limit ?? 25);
  if (error) throw new Error(`${error.message} (is migration 009 applied?)`);

  const s: ImageSummary = { found: 0, auto: 0, review: 0, none: 0, lines: [] };
  let aiDown: string | null = null;
  for (const row of data as Row[]) {
    const list = await candidates(row);
    if (!list.length) {
      s.none++;
      s.lines.push(`#${row.id} ${row.name}: no free photo found`);
      log(s.lines.at(-1)!);
      continue;
    }
    s.found++;
    let chosen: Candidate | null = null;
    let pickReason = "";
    for (const c of list.slice(0, MAX_AI_CHECKS)) {
      if (aiDown) break;
      let reason: string;
      try {
        const m = await askImageMatch(c.thumbUrl, { name: row.name, city: row.city, description: row.scene_note ?? "" });
        reason = m ? `${m.matches ? "match" : "no match"}: ${m.reason}` : "AI answer invalid";
        if (m?.matches) chosen = c;
      } catch (e) {
        if (e instanceof BudgetExhausted) throw e; // stop; nothing is saved for this place
        if (e instanceof ImageFetchError) { log(`  #${row.id} ${c.file}: ${e.message}`); if (c === list[0]) pickReason = e.message; continue; }
        const status = (e as { status?: number }).status;
        aiDown = status ? `AI unavailable (HTTP ${status})` : "AI unavailable";
        reason = aiDown;
      }
      log(`  #${row.id} ${c.file}: ${reason}`);
      if (c === list[0]) pickReason = reason;
      if (chosen) { pickReason = reason; break; }
    }
    // No match: the first candidate waits for a person, with Claude's reason for it.
    const pick = chosen ?? list[0];
    const status = chosen ? "auto" : null;
    const note = pickReason || aiDown || "not checked";
    if (status) s.auto++; else s.review++;
    s.lines.push(`#${row.id} ${row.name}: ${status ?? "needs review"}, ${pick.file} (${pick.license}); ${note}`);
    log(s.lines.at(-1)!);
    if (!o.dryRun) {
      const { error: upErr } = await db.from("locations").update(fields(pick, status, note)).eq("id", row.id);
      if (upErr) throw new Error(`#${row.id}: ${upErr.message}`);
    }
  }
  return s;
}
