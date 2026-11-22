// Nominatim for every worker together: answers are cached in geocode_cache, and each real request
// books a slot with throttle_slot() (advisory lock), so all workers combined stay at one request
// per second, as the usage policy asks. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NominatimHit } from "../geocode";

const BASE = "https://nominatim.openstreetmap.org/search";
const GAP_MS = 1100;
const CACHE_DAYS = 90;

/** Cache key: the parameters in a fixed order, the query trimmed and lowercased. */
export function cacheKey(params: Record<string, string>): string {
  return Object.keys(params).sort()
    .map((k) => `${k}=${k === "q" ? params[k].trim().toLowerCase().replace(/\s+/g, " ") : params[k]}`).join("&");
}

export async function nominatimSearch(db: SupabaseClient, params: Record<string, string>, contact: string): Promise<NominatimHit | null> {
  const key = cacheKey(params);
  const { data: cached } = await db.from("geocode_cache").select("hit, fetched_at").eq("query", key).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86400_000) return cached.hit as NominatimHit | null;

  const { data: wait, error } = await db.rpc("throttle_slot", { p_name: "nominatim", p_gap_ms: GAP_MS });
  if (error) throw new Error(`Nominatim throttle: ${error.message} (is migration 014 applied?)`);
  if ((wait as number) > 0) await new Promise((r) => setTimeout(r, wait as number));
  const res = await fetch(`${BASE}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": `ScreenPassport/0.1 (${contact})`, "Accept-Language": "de,en" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hit = ((await res.json()) as NominatimHit[])[0] ?? null;
  await db.from("geocode_cache").upsert({ query: key, hit, fetched_at: new Date().toISOString() });
  return hit;
}
