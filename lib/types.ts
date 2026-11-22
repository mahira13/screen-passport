export type WorkType = "series" | "film";
// geocoded_poi: a geocoder match on a named landmark (name and city checked); allows check-in.
export type CoordQuality = "source" | "approx" | "geocoded" | "geocoded_poi" | "verified";
export type LocationStatus = "live" | "unverified";
export type VerificationStatus = "draft" | "needs_review" | "verified" | "published" | "rejected";
export type LocationConfidence = "exact" | "building" | "street" | "area";
export type PublicAccess = "public" | "exterior_only" | "restricted" | "unknown";

export interface Work {
  id: string;
  title: string;
  type: WorkType;
  aliases: string[];
  year: number | null;
  /** Free-licensed Commons poster, only when confirmed ('auto') or approved. */
  poster?: { url: string; author: string; license: string; licenseUrl: string | null; page: string; kind: "poster" } | null;
}

export interface FilmLocation {
  id: number;
  work_id: string;
  name: string;
  scene_note: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  coord_quality: CoordQuality | null;
  visit_note: string | null;
  source_name: string | null;
  source_url: string;
  status: LocationStatus;
  geocode_query: string | null;
  // Added by migration 007. work_id and status above are deprecated: titles are in
  // location_works and status follows verification_status.
  country?: string | null;
  country_code?: string | null;
  verification_status?: VerificationStatus;
  location_confidence?: LocationConfidence | null;
  public_access?: PublicAccess;
  is_filming_location?: boolean;
  verified_at?: string | null;
  merged_into?: number | null;
  aliases?: string[]; // other names for the place (internal, for matching sources and geocoder results)
  verification_method?: "ai" | "team" | null; // migration 008
  depicts?: string | null; // from location_works, per title
}

/** One title filmed at one place (migration 007). */
export interface LocationWork {
  location_id: number;
  work_id: string;
  scene_note: string | null;
  depicts: string | null;
  evidence_url: string | null;
}

export interface Collection {
  id: string;
  name: string;
  city: string | null;
  work_ids: string[];
  description: string | null;
  featured_rank?: number | null; // migration 010: shown on Discover when set, lowest first
}

export interface LatLng {
  lat: number;
  lng: number;
}
