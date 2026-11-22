// The AI verification pipeline (CLAUDE.md product rule 4). Used by scripts/verify-locations.ts and
// the admin "Run AI verification" button. Server only: uses the service role key.
import { geocoderContact } from "../geocode";
import { REGION } from "../region";
import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineKm } from "../distance";
import type { NominatimHit } from "../geocode";
import { isTrustedSource } from "../trusted-sources";
import type { CoordQuality } from "../types";
import { askVerdict, type Verdict } from "./ai";
import { decide, type Decision } from "./decide";
import { fetchPage } from "./fetch-page";
import { classifyGeocode, type GeoCheck } from "./geo";
import { extractText, quoteFound } from "./text";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_GAP_MS = 1100; // policy: at most one request per second
const FAR_KM = 0.5;

type Link = { work_id: string; scene_note: string | null; depicts: string | null; evidence_url: string | null; works: { title: string } | null };
type Row = {
  id: number; name: string; city: string | null; lat: number | null; lng: number | null; coord_quality: CoordQuality | null;
  verification_status: string; source_url: string; geocode_query: string | null; location_works: Link[];
};

export type LinkResult = { workId: string; title: string; decision: Decision; quote: string | null; verdict: Verdict | null };
export type LocationResult = { id: number; name: string; decision: Decision["decision"]; reasons: string[]; links: LinkResult[] };
export type Summary = { published: number; needsReview: Record<string, number>; rejected: number; results: LocationResult[] };

export type RunOptions = { ids?: number[]; limit?: number; dryRun?: boolean; log?: (line: string) => void };

let lastNominatim = 0;
export async function geocode(q: string, contact: string): Promise<NominatimHit | null> {
  const wait = lastNominatim + NOMINATIM_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: REGION.countryCode.toLowerCase(), addressdetails: "1" });
  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": `ScreenPassport/0.1 (${contact})`, "Accept-Language": "de,en" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return ((await res.json()) as NominatimHit[])[0] ?? null;
}

export function contactOrThrow(): string {
  const c = geocoderContact();
  if (!c) throw new Error("Set GEOCODER_CONTACT (an email or project URL) for Nominatim and page fetches.");
  return c;
}

/** Overall decision for a place: published only if every title link passes. */
export function combine(links: LinkResult[]): { decision: Decision["decision"]; reasons: string[] } {
  const many = links.length > 1;
  const reasons = links.flatMap((l) => l.decision.reasons.map((r) => (many ? `${l.title}: ${r}` : r)));
  const ds = links.map((l) => l.decision.decision);
  if (ds.length && ds.every((d) => d === "published")) return { decision: "published", reasons: [] };
  if (ds.length && ds.every((d) => d === "rejected")) return { decision: "rejected", reasons };
  if (ds.includes("rejected") && !reasons.length) reasons.push("a title link was rejected");
  return { decision: "needs_review", reasons: reasons.length ? reasons : ["no title links to check"] };
}

async function loadQueue(db: SupabaseClient, o: RunOptions): Promise<Row[]> {
  let q = db
    .from("locations")
    .select("id, name, city, lat, lng, coord_quality, verification_status, source_url, geocode_query, location_works(work_id, scene_note, depicts, evidence_url, works(title))")
    .is("merged_into", null)
    .order("id");
  q = o.ids?.length ? q.in("id", o.ids) : q.or("verification_status.eq.draft,recheck.eq.true");
  const { data, error } = await q.limit(o.limit ?? 20);
  if (error) throw new Error(error.message);
  return data as unknown as Row[];
}

async function verifyRow(db: SupabaseClient, row: Row, contact: string, log: (s: string) => void): Promise<{ result: LocationResult; hit: NominatimHit | null; geo: GeoCheck | null }> {
  // Code checks shared by every title: where the place is.
  const hit = await geocode(row.geocode_query ?? [row.name, row.city, REGION.country].filter(Boolean).join(", "), contact).catch(() => null);
  const geo = hit ? classifyGeocode(hit, row.name, row.city) : null;
  const precise = row.coord_quality === "source" || row.coord_quality === "verified";
  const point = precise && row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng }
    : hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null;
  const far = precise && !!hit && row.lat !== null && row.lng !== null
    && haversineKm({ lat: row.lat, lng: row.lng }, { lat: Number(hit.lat), lng: Number(hit.lon) }) > FAR_KM;
  let duplicateIds: number[] = [];
  if (point) {
    const { data } = await db.rpc("nearby_locations", { p_lat: point.lat, p_lng: point.lng, p_radius_km: 0.03 });
    duplicateIds = ((data ?? []) as { id: number }[]).map((d) => d.id).filter((id) => id !== row.id);
  }

  const links: LinkResult[] = [];
  for (const link of row.location_works) {
    const title = link.works?.title ?? link.work_id;
    const url = link.evidence_url ?? row.source_url;
    const page = await fetchPage(url, contact);
    let verdict: Verdict | null = null;
    let aiError: string | undefined;
    let text = "";
    if (page.ok) {
      text = extractText(page.html);
      try {
        verdict = (await askVerdict({ title, place: row.name, city: row.city }, text)).verdict;
      } catch (e) {
        const status = (e as { status?: number }).status;
        // A bad key or missing permission fails every call: stop instead of filling the review queue.
        if (status === 401 || status === 403) throw new Error(`Anthropic API rejected the key (HTTP ${status}). Check ANTHROPIC_API_KEY.`);
        aiError = status ? `HTTP ${status}` : e instanceof Error ? e.message.slice(0, 80) : "unknown error";
      }
    }
    const decision = decide({
      fetched: page.ok,
      aiError,
      verdict,
      quoteFound: !!verdict && quoteFound(verdict.evidence_quote, text),
      trusted: isTrustedSource(page.ok ? page.url : url),
      geocode: geo,
      duplicateIds,
      existingQuality: row.coord_quality,
      geocodeFarFromSource: far,
    });
    if (!page.ok) log(`     ${title}: ${page.reason}`);
    links.push({ workId: link.work_id, title, decision, quote: verdict?.evidence_quote ?? null, verdict });
  }
  const overall = combine(links);
  return { result: { id: row.id, name: row.name, ...overall, links }, hit, geo };
}

async function save(db: SupabaseClient, row: Row, r: LocationResult, hit: NominatimHit | null, geo: GeoCheck | null) {
  const model = process.env.ANTHROPIC_MODEL ?? null;
  const geocodeInfo = hit && { category: hit.category, type: hit.type, addresstype: hit.addresstype, name: hit.name, display_name: hit.display_name, kind: geo?.kind };
  const { error: logErr } = await db.from("location_reviews").insert(r.links.map((l) => ({
    location_id: row.id, work_id: l.workId, method: "ai", decision: l.decision.decision, reasons: l.decision.reasons,
    evidence_url: row.location_works.find((w) => w.work_id === l.workId)?.evidence_url ?? row.source_url,
    evidence_quote: l.quote?.slice(0, 300) ?? null, ai_result: l.verdict, model, geocode: geocodeInfo,
  })));
  if (logErr) throw new Error(`review log #${row.id}: ${logErr.message}`);

  const patch: Record<string, unknown> = { verification_status: r.decision, recheck: false };
  if (r.decision === "published") {
    const d = r.links[0].decision; // every link passed; geo decisions are shared
    patch.verification_method = "ai";
    patch.location_confidence = d.confidence;
    if (d.coordQuality === "geocoded_poi" && hit) {
      Object.assign(patch, { lat: Number(hit.lat), lng: Number(hit.lon), coord_quality: "geocoded_poi" });
      if (geo?.bbox) Object.assign(patch, { bbox_south: geo.bbox[0], bbox_west: geo.bbox[1], bbox_north: geo.bbox[2], bbox_east: geo.bbox[3] });
    } else if (d.coordQuality === "approx") {
      patch.coord_quality = "approx";
      if (row.lat === null && hit) Object.assign(patch, { lat: Number(hit.lat), lng: Number(hit.lon) });
    }
  }
  const { error } = await db.from("locations").update(patch).eq("id", row.id);
  if (error) throw new Error(`#${row.id}: ${error.message}`);
  for (const l of r.links) {
    if (l.verdict?.depicts && r.decision === "published") {
      await db.from("location_works").update({ depicts: l.verdict.depicts }).eq("location_id", row.id).eq("work_id", l.workId).is("depicts", null);
    }
  }
}

export async function runVerification(db: SupabaseClient, o: RunOptions = {}): Promise<Summary> {
  const log = o.log ?? (() => {});
  const contact = contactOrThrow();
  const rows = await loadQueue(db, o);
  const summary: Summary = { published: 0, needsReview: {}, rejected: 0, results: [] };
  for (const row of rows) {
    log(`#${row.id} ${row.name}`);
    const { result, hit, geo } = await verifyRow(db, row, contact, log);
    if (!o.dryRun) await save(db, row, result, hit, geo);
    summary.results.push(result);
    if (result.decision === "published") summary.published++;
    else if (result.decision === "rejected") summary.rejected++;
    else for (const reason of new Set(result.links.flatMap((l) => l.decision.reasons))) summary.needsReview[reason] = (summary.needsReview[reason] ?? 0) + 1;
    log(`   → ${result.decision}${result.reasons.length ? `: ${result.reasons.join("; ")}` : ""}${geo ? ` [geocode: ${geo.kind}]` : " [no geocode]"}`);
  }
  return summary;
}
