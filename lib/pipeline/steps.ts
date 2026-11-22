// What each job does. Every step is idempotent: running it twice finds what the first run added
// and adds nothing new. Nothing here publishes directly: only runVerification (rule 4) or a
// teammate can. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOutline } from "../distance";
import { autoMerges, onlyDuplicateOf } from "../duplicates";
import { geocoderContact } from "../geocode";
import { runImages } from "../images/run";
import { matchTitle } from "../match";
import { REGION } from "../region";
import { isTrustedSource } from "../trusted-sources";
import type { Work } from "../types";
import { namesMatch } from "../verify/geo";
import { geocode, runVerification } from "../verify/run";
import { classifyAny, namesAny } from "../verify/upgrade";
import { discoverQuery, draftRow, filmingLocationsQuery, findExisting, toCandidate, toDiscovered, toWorkItem, workTypesQuery, type Existing, type WorkItem } from "../wikidata";
import { dailyBudget } from "./cost";
import { enqueue, type Job, PRIORITY } from "./jobs";
import { pickRequested, splitYear, workIdFor } from "./plan";
import { domainGroups } from "./research";
import { research } from "./research-net";
import { searchItems, sparql, tmdbConfigured, tmdbMetadata } from "./sources-net";

export type Stats = { candidates: number; published: number; needsReview: number; rejected: number; merged: number; notes: string[] };
export const emptyStats = (): Stats => ({ candidates: 0, published: 0, needsReview: 0, rejected: 0, merged: 0, notes: [] });

const DISCOVER_PAGE = 50;
const VERIFY_CHUNK = 2; // places per verify job: one job fits in a request's time window
const OUTLINE_MIN_M = 150; // bounding box diagonal from which a place counts as a large site
const OUTLINE_MAX_CHARS = 50_000;

const followUp = (job: Job) => ({ requestId: job.request_id, priority: job.priority });
const today = () => new Date().toISOString().slice(0, 10);

async function setRequest(db: SupabaseClient, id: number | null, patch: Record<string, unknown>) {
  if (id === null) return;
  const { error } = await db.from("requests").update(patch).eq("id", id);
  if (error) throw new Error(`request #${id}: ${error.message}`);
}

// ---- discover: new titles filmed in the region, from Wikidata ----

export async function discover(db: SupabaseClient, job: Job): Promise<unknown> {
  const offset = Number(job.payload.offset ?? 0);
  const rows = (await sparql(discoverQuery(DISCOVER_PAGE, offset))).flatMap((r) => toDiscovered(r) ?? []);
  const { data: known, error } = await db.from("works").select("wikidata_id").not("wikidata_id", "is", null);
  if (error) throw new Error(error.message);
  const have = new Set((known ?? []).map((w) => w.wikidata_id as string));
  let queued = 0;
  for (const d of rows.filter((r) => !have.has(r.qid))) {
    if (await enqueue(db, "title", { qid: d.qid, label: d.label, type: d.type, year: d.year }, { dedupeKey: `title:${d.qid}` })) queued++;
  }
  if (rows.length === DISCOVER_PAGE) {
    await enqueue(db, "discover", { offset: offset + DISCOVER_PAGE }, { dedupeKey: `discover:${today()}:${offset + DISCOVER_PAGE}`, priority: PRIORITY.background });
  }
  return { offset, seen: rows.length, queued };
}

// ---- title: the work, its Wikidata candidates, then research and verification ----

async function resolveItem(job: Job): Promise<{ item: WorkItem; label: string } | { message: string }> {
  if (typeof job.payload.qid === "string") {
    const [item] = (await sparql(workTypesQuery([job.payload.qid]))).map(toWorkItem);
    if (!item || !(item.film || item.series)) return { message: "That Wikidata item isn't a film or series." };
    return { item, label: typeof job.payload.label === "string" ? job.payload.label : item.labels[0] ?? item.qid };
  }
  const text = String(job.payload.text ?? "");
  const ids = await searchItems(splitYear(text).title);
  const picked = pickRequested(text, ids.length ? (await sparql(workTypesQuery(ids))).map(toWorkItem) : []);
  if ("none" in picked) return { message: `We couldn't find a film or series called “${text}”.` };
  if ("ambiguous" in picked) return { message: `Several titles are called “${splitYear(text).title}”. Try adding the year, e.g. “${splitYear(text).title} ${picked.ambiguous[0].year ?? 2020}”.` };
  const want = splitYear(text).title.toLowerCase();
  return { item: picked.item, label: picked.item.labels.find((l) => l.toLowerCase() === want) ?? picked.item.labels[0] };
}

/** Our work for a Wikidata item: by wikidata_id, else an existing work with that title (seed rows), else a new one. */
async function upsertWork(db: SupabaseClient, item: WorkItem, label: string): Promise<Work> {
  const { data: works, error } = await db.from("works").select("id, title, type, aliases, year, wikidata_id");
  if (error) throw new Error(error.message);
  const all = works as (Work & { wikidata_id: string | null })[];
  const type = item.series ? "series" : "film";
  const byQid = all.find((w) => w.wikidata_id === item.qid);
  if (byQid) return byQid;
  const byTitle = matchTitle(label, all.filter((w) => !w.wikidata_id && w.type === type && (w.year === null || item.year === null || w.year === item.year)));
  if (byTitle) {
    await db.from("works").update({ wikidata_id: item.qid }).eq("id", byTitle.id);
    return byTitle;
  }
  const aliases = [...new Set(item.labels.filter((l) => l !== label))].slice(0, 8);
  const work: Work & { wikidata_id: string } = {
    id: workIdFor(label, item.year, item.qid, new Set(all.map((w) => w.id))),
    title: label, type, aliases, year: item.year, wikidata_id: item.qid,
  };
  const { error: insErr } = await db.from("works").insert(work);
  if (insErr) throw new Error(`work ${work.id}: ${insErr.message}`);
  return work;
}

async function placesOfWork(db: SupabaseClient, workId: string): Promise<(Existing & { verification_status: string; work_id: string })[]> {
  const { data, error } = await db.from("location_works")
    .select("locations!inner(id, name, city, lat, lng, verification_status, work_id, merged_into)").eq("work_id", workId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.locations as unknown as Existing & { verification_status: string; work_id: string; merged_into: number | null })
    .filter((l) => l.merged_into === null);
}

export async function title(db: SupabaseClient, job: Job, stats: Stats): Promise<unknown> {
  await setRequest(db, job.request_id, { search_status: "searching", searched_at: new Date().toISOString() });
  const resolved = await resolveItem(job);
  if ("message" in resolved) {
    await setRequest(db, job.request_id, { search_status: "nothing", message: resolved.message });
    return { resolved: false, message: resolved.message };
  }
  let work = await upsertWork(db, resolved.item, resolved.label);
  await setRequest(db, job.request_id, { work_id: work.id });

  if (tmdbConfigured()) {
    try {
      const m = await tmdbMetadata(work);
      if (m && (m.year !== work.year || m.added.length)) {
        await db.from("works").update({ year: m.year, aliases: m.aliases }).eq("id", work.id);
        work = { ...work, year: m.year, aliases: m.aliases };
      }
    } catch (e) {
      stats.notes.push(`TMDB ${work.id}: ${e instanceof Error ? e.message : e}`); // metadata is optional
    }
  }

  const existing = await placesOfWork(db, work.id);
  let added = 0;
  for (const c of (await sparql(filmingLocationsQuery(resolved.item.qid))).map(toCandidate)) {
    if (c.skip || findExisting(c, existing)) continue;
    const row = { ...draftRow(c, work.id), wikidata_id: c.qid };
    const { data, error } = await db.from("locations").insert(row).select("id").single();
    if (error) { stats.notes.push(`candidate ${c.qid}: ${error.message}`); continue; }
    existing.push({ id: data.id as number, name: c.name, city: c.city, lat: c.lat, lng: c.lng, verification_status: "draft", work_id: work.id });
    added++;
  }
  stats.candidates += added;

  // Wikidata rarely cites a trusted page, so its candidates can't pass alone: research next.
  if (dailyBudget() !== null && process.env.ANTHROPIC_API_KEY) {
    await enqueue(db, "research", { workId: work.id, group: 0 }, { ...followUp(job), dedupeKey: `research:${work.id}:0:${today()}` });
  } else {
    await queueVerification(db, job, work.id);
  }
  return { workId: work.id, qid: resolved.item.qid, candidates: added };
}

/** Verify jobs for every draft of a work, a few places each. */
async function queueVerification(db: SupabaseClient, job: Job, workId: string) {
  const drafts = (await placesOfWork(db, workId)).filter((p) => p.verification_status === "draft").map((p) => p.id).sort((a, b) => a - b);
  for (let i = 0; i < drafts.length; i += VERIFY_CHUNK) {
    const ids = drafts.slice(i, i + VERIFY_CHUNK);
    await enqueue(db, "verify", { ids }, { ...followUp(job), dedupeKey: `verify:${ids.join(",")}` });
  }
  return drafts.length;
}

// ---- research: trusted pages for a work's places (Claude proposes, verification decides) ----

export async function researchStep(db: SupabaseClient, job: Job, stats: Stats): Promise<unknown> {
  const workId = String(job.payload.workId);
  const group = Number(job.payload.group ?? 0);
  const { data: w, error } = await db.from("works").select("id, title, type, aliases, year").eq("id", workId).single();
  if (error) throw new Error(error.message);
  const work = w as Work;
  const leads = await research(work, [group]);
  const places = await placesOfWork(db, workId);
  let attached = 0;
  let added = 0;
  for (const lead of leads) {
    if (!isTrustedSource(lead.url)) continue;
    const host = new URL(lead.url).hostname.replace(/^www\./, "");
    const match = findExisting({ qid: "", name: lead.name, city: lead.city, lat: null, lng: null, confidence: "area", refs: [], skip: null }, places);
    if (match) {
      const p = places.find((x) => x.id === match.place.id)!;
      if (p.verification_status === "published") continue; // already verified; never touched here
      // Better evidence for a place still waiting: the link gets the page, the place is checked again.
      await db.from("location_works").update({ evidence_url: lead.url, evidence_name: host }).eq("location_id", p.id).eq("work_id", workId);
      if (p.verification_status === "needs_review") await db.from("locations").update({ verification_status: "draft" }).eq("id", p.id);
      p.verification_status = "draft";
      attached++;
      continue;
    }
    const { data, error: insErr } = await db.from("locations").insert({
      work_id: workId, name: lead.name, city: lead.city, lat: null, lng: null, coord_quality: null, scene_note: null,
      geocode_query: [lead.name, lead.city, REGION.country].filter(Boolean).join(", "),
      source_url: lead.url, source_name: host, status: "unverified", verification_status: "draft",
      public_access: "unknown", is_filming_location: true, country: REGION.country, country_code: REGION.countryCode,
    }).select("id").single();
    if (insErr) { stats.notes.push(`lead ${lead.name}: ${insErr.message}`); continue; }
    places.push({ id: data.id as number, name: lead.name, city: lead.city, lat: null, lng: null, verification_status: "draft", work_id: workId });
    added++;
  }
  stats.candidates += added;
  const next = group + 1;
  if (leads.length < 8 && next < domainGroups().length) {
    await enqueue(db, "research", { workId, group: next }, { ...followUp(job), dedupeKey: `research:${workId}:${next}:${today()}` });
  } else {
    await queueVerification(db, job, workId);
  }
  return { workId, group, leads: leads.length, attached, added };
}

// ---- verify: the AI verification pipeline, then photos, outlines and duplicate merges ----

export async function verify(db: SupabaseClient, job: Job, stats: Stats): Promise<unknown> {
  const ids = (job.payload.ids as number[]).filter(Number.isInteger);
  const summary = await runVerification(db, { ids, limit: ids.length });
  const published: number[] = [];
  for (const r of summary.results) {
    if (r.decision === "published") { published.push(r.id); stats.published++; continue; }
    if (r.decision === "rejected") { stats.rejected++; continue; }
    // Everything passed except a published place within 30 m: if it is the same named place, merge
    // this (now verified) title link into it instead of leaving a duplicate for review.
    const dup = onlyDuplicateOf(r.reasons);
    const keep = dup && await sameNamedPlace(db, r.id, dup);
    if (keep) {
      const { error } = await db.rpc("merge_locations", { p_keep: keep, p_drop: [r.id] });
      if (error) throw new Error(`merge #${r.id} into #${keep}: ${error.message}`);
      stats.merged++;
      published.push(keep);
    } else stats.needsReview++;
  }
  if (published.length) {
    await enqueue(db, "images", { ids: published }, { ...followUp(job), priority: PRIORITY.normal });
    await enqueue(db, "outline", { ids: published }, { ...followUp(job), priority: PRIORITY.normal });
  }
  return { published: summary.published, rejected: summary.rejected, results: summary.results.map((r) => ({ id: r.id, decision: r.decision, reasons: r.reasons })) };
}

async function sameNamedPlace(db: SupabaseClient, id: number, candidates: number[]): Promise<number | null> {
  const { data } = await db.from("locations").select("id, name, aliases, city, lat, lng, verification_status").in("id", [id, ...candidates]);
  const rows = (data ?? []) as { id: number; name: string; aliases: string[] | null; city: string | null; lat: number | null; lng: number | null; verification_status: string }[];
  const me = rows.find((r) => r.id === id);
  if (!me) return null;
  const names = (r: typeof me) => [r.name, ...(r.aliases ?? [])];
  const other = rows.find((r) => r.id !== id && r.verification_status === "published"
    && names(me).some((a) => names(r).some((b) => namesMatch(a, b, me.city ?? r.city))));
  return other?.id ?? null;
}

export async function images(db: SupabaseClient, job: Job): Promise<unknown> {
  const ids = (job.payload.ids as number[]).filter(Number.isInteger);
  const s = await runImages(db, { ids, limit: ids.length });
  return { found: s.found, auto: s.auto, review: s.review, none: s.none };
}

// ---- outline: OSM site outline for large landmarks, so check-in works anywhere inside ----

const diagonalM = (b: [number, number, number, number]) => {
  const dy = (b[2] - b[0]) * 111_320;
  const dx = (b[3] - b[1]) * 111_320 * Math.cos(((b[0] + b[2]) / 2) * Math.PI / 180);
  return Math.hypot(dx, dy);
};

export async function outline(db: SupabaseClient, job: Job): Promise<unknown> {
  const contact = geocoderContact();
  if (!contact) throw new Error("Set GEOCODER_CONTACT for Nominatim.");
  const ids = (job.payload.ids as number[]).filter(Number.isInteger);
  const { data, error } = await db.from("locations")
    .select("id, name, aliases, city, geocode_query, coord_quality, check_in_area, bbox_south, bbox_west, bbox_north, bbox_east, verification_status")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const done: number[] = [];
  for (const row of data ?? []) {
    const box = [row.bbox_south, row.bbox_west, row.bbox_north, row.bbox_east] as [number, number, number, number];
    if (row.verification_status !== "published" || row.coord_quality !== "geocoded_poi" || row.check_in_area || box.some((x) => x == null)) continue;
    if (diagonalM(box) < OUTLINE_MIN_M) continue; // a building: the box is enough
    const q = row.geocode_query ?? [row.name, row.city, REGION.country].filter(Boolean).join(", ");
    const hit = await geocode(db, q, contact, { polygon_geojson: "1", polygon_threshold: "0.00005" });
    if (!hit) continue;
    const names = [row.name, ...(row.aliases ?? [])];
    const geo = classifyAny(hit, names, row.city);
    const shape = parseOutline((hit as { geojson?: unknown }).geojson);
    if (!shape || !namesAny(hit.name ?? "", names, row.city) || !geo.cityMatch || geo.kind === "residential" || JSON.stringify(shape).length > OUTLINE_MAX_CHARS) continue;
    const { error: upErr } = await db.from("locations").update({ check_in_area: shape }).eq("id", row.id);
    if (upErr) throw new Error(`#${row.id}: ${upErr.message}`);
    await db.from("location_reviews").insert({
      location_id: row.id, method: "ai", decision: "published",
      reasons: ["large site: check-in anywhere inside its OSM outline (same name and city as the published place)"],
      geocode: { name: hit.name, category: hit.category, type: hit.type, display_name: hit.display_name, kind: geo.kind },
    });
    done.push(row.id);
  }
  return { outlines: done };
}

// ---- dedupe: merge published places that are the same named place within 30 m ----

export async function dedupe(db: SupabaseClient, _job: Job, stats: Stats): Promise<unknown> {
  const { data, error } = await db.from("locations").select("id, name, aliases, city, lat, lng")
    .eq("verification_status", "published").is("merged_into", null);
  if (error) throw new Error(error.message);
  const merges = autoMerges(data ?? [], namesMatch);
  for (const m of merges) {
    const { error: mErr } = await db.rpc("merge_locations", { p_keep: m.keep, p_drop: m.drop });
    if (mErr) throw new Error(`merge into #${m.keep}: ${mErr.message}`);
    stats.merged += m.drop.length;
  }
  return { merges };
}

// ---- recheck: places held back for reasons that can change (site down, AI error, no geocode) ----

const TRANSIENT = /^(source unreachable|AI call failed|AI answer missing|no geocoder match)/;
const RECHECK_LIMIT = 30;

export async function recheck(db: SupabaseClient): Promise<unknown> {
  const { data, error } = await db.from("locations").select("id, location_reviews(reasons, created_at)")
    .eq("verification_status", "needs_review").is("merged_into", null).limit(500);
  if (error) throw new Error(error.message);
  const cutoff = Date.now() - 2 * 86400_000;
  const ids = (data ?? []).flatMap((l) => {
    const reviews = ((l.location_reviews ?? []) as { reasons: string[]; created_at: string }[])
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const last = reviews[0];
    return last && new Date(last.created_at).getTime() < cutoff && last.reasons.length && last.reasons.every((r) => TRANSIENT.test(r)) ? [l.id as number] : [];
  }).slice(0, RECHECK_LIMIT);
  for (let i = 0; i < ids.length; i += VERIFY_CHUNK) {
    const chunk = ids.slice(i, i + VERIFY_CHUNK);
    await enqueue(db, "verify", { ids: chunk }, { dedupeKey: `verify:${chunk.join(",")}`, priority: PRIORITY.background });
  }
  return { queued: ids.length };
}
