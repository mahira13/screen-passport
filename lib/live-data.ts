import { cacheLife, cacheTag } from "next/cache";
import type { LiveLocation } from "./nearby";
import { supabasePublic } from "./supabase";
import type { Collection, Work } from "./types";

export const LIVE_TAG = "live-locations";

// "relation does not exist" from Postgres and from PostgREST's schema cache.
const MISSING = new Set(["42P01", "PGRST205"]);

export interface LiveData {
  configured: boolean;
  works: Work[];
  locations: LiveLocation[];
  collections: Collection[];
}

const COLUMNS = "id, work_id, name, city, lat, lng, coord_quality, scene_note, visit_note, source_name, source_url";

/**
 * Published filming places with coordinates, one row per place and title (catalogue_entries,
 * migration 007), plus works and collections. Until 007 is applied it reads the old
 * mappable_locations view. Cached: the list only changes when an admin publishes a place
 * (that action refreshes LIVE_TAG). Uses the anon key, so RLS also keeps unpublished rows out.
 */
export async function getLiveData(): Promise<LiveData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LIVE_TAG);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { configured: false, works: [], locations: [], collections: [] };
  }
  const db = supabasePublic();
  const catalogue = () =>
    db.from("catalogue_entries").select(`${COLUMNS}, country, country_code, location_confidence, public_access, depicts`);
  const [locs, works, cols] = await Promise.all([
    catalogue().then((r) =>
      r.error && MISSING.has(r.error.code) ? db.from("mappable_locations").select(COLUMNS) : r,
    ),
    db.from("works").select("id, title, type, aliases, year"),
    db.from("collections").select("id, name, city, work_ids, description"),
  ]);
  if (locs.error) throw new Error(`locations: ${locs.error.message}`);
  if (works.error) throw new Error(`works: ${works.error.message}`);
  if (cols.error) throw new Error(`collections: ${cols.error.message}`);
  return {
    configured: true,
    works: works.data as Work[],
    locations: locs.data as LiveLocation[],
    collections: cols.data as Collection[],
  };
}
