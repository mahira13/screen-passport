import { cacheLife, cacheTag } from "next/cache";
import type { LiveLocation } from "./nearby";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublic } from "./supabase";
import type { Collection, Work } from "./types";
import { isPlaceholderTitle } from "./work-title";

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
    loadWorks(db),
    loadCollections(db),
  ]);
  if (locs.error) throw new Error(`locations: ${locs.error.message}`);
  if (works.error) throw new Error(`works: ${works.error.message}`);
  if (cols.error) throw new Error(`collections: ${cols.error.message}`);
  // A work without a real name is never shown, and its places don't carry it.
  const named = (works.data as WorkRow[]).filter((w) => !isPlaceholderTitle(w.title)).map(toWork);
  const ids = new Set(named.map((w) => w.id));
  return {
    configured: true,
    works: named,
    locations: (locs.data as unknown as LiveLocation[]).filter((l) => ids.has(l.work_id)),
    collections: cols.data as Collection[],
  };
}

const MISSING = new Set(["42703", "42P01", "PGRST204", "PGRST205"]); // column or table not there yet

/** Collections with their hand-picked places (migration 018); before 018, without them. */
export async function loadCollections(db: SupabaseClient) {
  const base = "id, name, city, work_ids, description, featured_rank";
  const [cols, items] = await Promise.all([
    db.from("collections").select(`${base}, published`),
    db.from("collection_items").select("collection_id, location_id, position").order("position"),
  ]);
  if (cols.error && MISSING.has(cols.error.code)) return db.from("collections").select(base);
  if (cols.error || (items.error && !MISSING.has(items.error.code))) return { data: null, error: cols.error ?? items.error };
  const picked = new Map<string, number[]>();
  for (const i of (items.data ?? []) as { collection_id: string; location_id: number }[]) {
    picked.set(i.collection_id, [...(picked.get(i.collection_id) ?? []), i.location_id]);
  }
  return { data: (cols.data as Collection[]).map((c) => ({ ...c, location_ids: picked.get(c.id) ?? [] })), error: null };
}

type WorkRow = Omit<Work, "poster"> & {
  poster_thumb_url?: string | null; poster_author?: string | null; poster_license?: string | null;
  poster_license_url?: string | null; poster_page?: string | null; poster_status?: string | null;
};

// Before migration 017 the poster columns don't exist: load the works without them.
async function loadWorks(db: ReturnType<typeof supabasePublic>) {
  const withPosters = await db.from("works")
    .select("id, title, type, aliases, year, poster_thumb_url, poster_author, poster_license, poster_license_url, poster_page, poster_status");
  return withPosters.error?.code === "42703" ? db.from("works").select("id, title, type, aliases, year") : withPosters;
}

function toWork({ poster_thumb_url: url, poster_author: author, poster_license: license, poster_license_url, poster_page: page, poster_status, ...w }: WorkRow): Work {
  const shown = (poster_status === "auto" || poster_status === "approved") && url && author && license && page;
  return { ...w, poster: shown ? { url, author, license, licenseUrl: poster_license_url ?? null, page, kind: "poster" } : null };
}
