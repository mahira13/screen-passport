import { cacheLife, cacheTag } from "next/cache";
import type { LiveLocation } from "./nearby";
import { supabasePublic } from "./supabase";
import type { Collection, Work } from "./types";

export const LIVE_TAG = "live-locations";

export interface LiveData {
  configured: boolean;
  works: Work[];
  locations: LiveLocation[];
  collections: Collection[];
}

const COLUMNS = [
  "id, work_id, name, city, lat, lng, coord_quality, scene_note, visit_note, source_name, source_url",
  "address, region, country, country_code, location_confidence, public_access, depicts",
  "verification_method, bbox_south, bbox_west, bbox_north, bbox_east",
  "image_thumb_url, image_author, image_license, image_license_url, image_source_page, check_in_area",
].join(", ");

/**
 * Published filming places with coordinates, one row per place and title (catalogue_entries),
 * plus works and collections. Cached: the list only changes when an admin publishes a place
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
  const [locs, works, cols] = await Promise.all([
    db.from("catalogue_entries").select(COLUMNS),
    db.from("works").select("id, title, type, aliases, year"),
    db.from("collections").select("id, name, city, work_ids, description, featured_rank"),
  ]);
  if (locs.error) throw new Error(`locations: ${locs.error.message}`);
  if (works.error) throw new Error(`works: ${works.error.message}`);
  if (cols.error) throw new Error(`collections: ${cols.error.message}`);
  return {
    configured: true,
    works: works.data as Work[],
    locations: locs.data as unknown as LiveLocation[],
    collections: cols.data as Collection[],
  };
}
