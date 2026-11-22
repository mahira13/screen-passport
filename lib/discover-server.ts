// Server side of Discover: radius via nearby_locations, search via search_catalogue, popular titles.
import { cacheLife, cacheTag } from "next/cache";
import { autoRadius, centreOf, popularTitles, withinRadius, type PopularTitle, type Radius, type SearchHit } from "./discover";
import { getLiveData, LIVE_TAG, MISSING } from "./live-data";
import { searchWorks } from "./match";
import { buildNearby, type NearbyResult } from "./nearby";
import { supabaseAdmin, supabasePublic } from "./supabase";
import type { LatLng } from "./types";

/** "auto": the smallest chip with at least 3 places around the start (see autoRadius), and which one it picked. */
export async function nearbyAuto(from: LatLng): Promise<NearbyResult & { radius: Radius }> {
  const data = await getLiveData();
  const radius = autoRadius(buildNearby(data.locations, data.works, from).places);
  return { ...(await nearbyWithin(from, radius)), radius };
}

/** Published places within the radius (PostGIS nearby_locations), shaped like the rest of the app. */
export async function nearbyWithin(from: LatLng, radius: Radius): Promise<NearbyResult> {
  const data = await getLiveData();
  if (radius === null) return buildNearby(data.locations, data.works, from);
  const { data: rows, error } = await supabasePublic().rpc("nearby_locations", {
    p_lat: from.lat, p_lng: from.lng, p_radius_km: radius, p_max_results: 1000,
  });
  if (error && !MISSING.has(error.code)) throw new Error(`nearby_locations: ${error.message}`);
  const located = data.locations.filter((l): l is typeof l & LatLng => l.lat != null && l.lng != null);
  const ids = new Set((rows as { id: number }[] | null)?.map((r) => r.id));
  const inside = error ? withinRadius(located, from, radius) /* before migration 007 */ : located.filter((l) => ids.has(l.id));
  return buildNearby(inside, data.works, from);
}


/** Films, series, cities and countries from our catalogue (search_catalogue). Cities and countries get a centre to start from. */
export async function searchCatalogue(q: string): Promise<SearchHit[]> {
  const data = await getLiveData();
  const { data: rows, error } = await supabasePublic().rpc("search_catalogue", { q });
  if (error && !MISSING.has(error.code)) throw new Error(`search_catalogue: ${error.message}`);
  if (error) {
    // Before migration 007: titles only, matched in code.
    const live = new Set(data.locations.map((l) => l.work_id));
    return searchWorks(q, data.works.filter((w) => live.has(w.id))).map((w) => ({
      kind: "work", id: w.id, label: w.title, places: data.locations.filter((l) => l.work_id === w.id).length, centre: null,
    }));
  }
  type Row = { kind: SearchHit["kind"]; id: string; label: string; places: number };
  const located = data.locations.filter((l): l is typeof l & LatLng => l.lat != null && l.lng != null);
  return (rows as Row[]).map((r) => ({
    kind: r.kind, id: r.id, label: r.label, places: r.places,
    centre: r.kind === "city" ? centreOf(located.filter((l) => l.city === r.id))
      : r.kind === "country" ? centreOf(located.filter((l) => l.country_code === r.id))
      : null,
  }));
}

/** Popular titles: how many saved passports marked each one watched. Counts only, never passport ids. */
export async function popularData(): Promise<PopularTitle[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(LIVE_TAG);
  try {
    const data = await getLiveData();
    const places = new Map<string, number>(); // one row per place and title, so each pair counts once
    for (const l of data.locations) places.set(l.work_id, (places.get(l.work_id) ?? 0) + 1);
    let lists: string[][] = [];
    try {
      const { data: rows, error } = await supabaseAdmin().from("passports").select("watched").limit(10000);
      if (!error) lists = (rows as { watched: string[] }[]).map((r) => r.watched ?? []);
    } catch {
      // no service key (e.g. a preview build): rank by places only
    }
    return popularTitles(lists, data.works, places);
  } catch (e) {
    console.error("popular titles failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
