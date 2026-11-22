// On-demand title searches: a visitor asks for a title we don't have, the pipeline looks for it
// (Wikidata, research on trusted sites, AI verification) and the page polls the status. Only
// verified places are ever shown; a request never becomes an AI answer (product rule 2). Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITS, takeRate } from "../rate-limit";
import { enqueue, PRIORITY, requestJobCounts } from "./jobs";
import { searchText, searchView, type SearchStatus, type SearchView } from "./plan";
import { runPipeline } from "./worker";

/** How long a finished search stands before a new request for the same title searches again. */
const RESEARCH_AFTER_DAYS = 7;
/** Seconds of work per call: inside the function limit (maxDuration 60 on every Vercel plan). */
export const REQUEST_WORK_SECONDS = Number(process.env.PIPELINE_REQUEST_SECONDS ?? 45);

export type RequestStatus = SearchView & { requestId: number; title: string; text: string; href: string | null };

type Row = { id: number; raw_title: string; search_status: SearchStatus | null; found: number; message: string | null; work_id: string | null; searched_at: string | null };
const COLUMNS = "id, raw_title, search_status, found, message, work_id, searched_at";

export async function requestStatus(db: SupabaseClient, id: number): Promise<RequestStatus | null> {
  const { data, error } = await db.from("requests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Row;
  const counts = await requestJobCounts(db, id);
  const view = searchView(r, counts.open, counts.running);
  return {
    ...view, requestId: r.id, title: r.raw_title, text: searchText(view, r.raw_title),
    href: view.done && view.found > 0 && view.workId ? `/title/${encodeURIComponent(view.workId)}` : null,
  };
}

export type StartResult = { ok: true; status: RequestStatus; started: boolean } | { ok: false; status: number; error: string };

/**
 * Counts the request (add_request) and starts a search unless one is running or finished recently.
 * Starting is rate limited per visitor and in total; counting never is.
 */
export async function startTitleSearch(db: SupabaseClient, raw: string, normalised: string, ipHash: string): Promise<StartResult> {
  const { error: addErr } = await db.rpc("add_request", { p_raw: raw, p_normalised: normalised });
  if (addErr) throw new Error(`request: ${addErr.message}`);
  const { data, error } = await db.from("requests").select(COLUMNS).eq("normalised_title", normalised).single();
  if (error) throw new Error(error.message);
  const r = data as Row;

  const counts = await requestJobCounts(db, r.id);
  const recent = r.searched_at && Date.now() - new Date(r.searched_at).getTime() < RESEARCH_AFTER_DAYS * 86400_000;
  const busy = counts.open > 0 || r.search_status === "queued" || r.search_status === "searching";
  if (busy || (recent && (r.search_status === "found" || r.search_status === "nothing"))) {
    return { ok: true, status: (await requestStatus(db, r.id))!, started: false };
  }
  if (!(await takeRate(LIMITS.titleSearchPerIp, ipHash))) {
    return { ok: false, status: 429, error: "You've started a few searches today. Your request is saved; try again tomorrow." };
  }
  if (!(await takeRate(LIMITS.titleSearchGlobal, "global"))) {
    return { ok: false, status: 429, error: "We're searching a lot of titles today. Your request is saved and we'll look soon." };
  }
  await db.from("requests").update({ search_status: "queued", message: null, found: 0, searched_at: new Date().toISOString() }).eq("id", r.id);
  await enqueue(db, "title", { text: raw }, { requestId: r.id, priority: PRIORITY.request, dedupeKey: `request:${r.id}` });
  return { ok: true, status: (await requestStatus(db, r.id))!, started: true };
}

/** Works on one request's jobs for a few seconds (called after the response is sent). */
export function workOnRequest(db: SupabaseClient, requestId: number) {
  return runPipeline(db, { trigger: "request", requestId, deadline: Date.now() + REQUEST_WORK_SECONDS * 1000 })
    .catch((e) => console.error(`request #${requestId} work failed:`, e instanceof Error ? e.message : e));
}
