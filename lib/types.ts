export type WorkType = "series" | "film";
export type CoordQuality = "source" | "approx" | "geocoded" | "verified";
export type LocationStatus = "live" | "unverified";

export interface Work {
  id: string;
  title: string;
  type: WorkType;
  aliases: string[];
  year: number | null;
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
}

export interface Collection {
  id: string;
  name: string;
  city: string | null;
  work_ids: string[];
  description: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}
