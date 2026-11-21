import { haversineKm } from "./distance";
import { randomId } from "./ids";
import { getLiveData } from "./live-data";
import { supabaseAdmin } from "./supabase";
import {
  nearestCity, parseFrom, parseStartsAt, parseWorkIds, isTravelMode, isTripLength, selectTripStops,
  validateFirstName, type TripPlan, type TripStop,
} from "./trip";
import { writeTripPlan } from "./trip-ai";
import type { TravelMode } from "./route";
import type { LatLng } from "./types";

export type CreateResult =
  | { ok: true; id: string; stops: number; source: TripPlan["source"] }
  | { ok: false; status: number; error: string; nearestCity?: string | null };

/** Validates the form, picks stops in code, lets Claude write the words, saves. */
export async function createTrip(body: Record<string, unknown>): Promise<CreateResult> {
  const workIds = parseWorkIds(Array.isArray(body.works) ? body.works.join(",") : String(body.works ?? ""));
  const start = parseFrom(typeof body.from === "string" ? body.from : null);
  const startsAt = parseStartsAt(body.startsAt);
  const name = validateFirstName(body.firstName);
  const { mode, length } = body;
  if (!workIds.length || !start || !isTravelMode(mode) || !isTripLength(length))
    return { ok: false, status: 400, error: "Pick at least one title, a start, a mode and a length." };
  if (!startsAt) return { ok: false, status: 400, error: "Pick a date and time from today on." };
  if (!name) return { ok: false, status: 400, error: "Add your first name (letters only, up to 30)." };

  const live = await getLiveData();
  const known = workIds.filter((id) => live.works.some((w) => w.id === id));
  const stops = selectTripStops(live.locations, live.works, known, start, mode, length);
  if (stops.length === 0)
    return { ok: false, status: 422, error: "none_in_range", nearestCity: nearestCity(live.locations, known, start) };

  const plan = await writeTripPlan(stops, { start, mode, length, startsAt: startsAt.toISOString() });
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId();
    const { error } = await db.from("trips").insert({
      id,
      title: plan.title,
      intro: plan.intro,
      work_ids: known,
      start_label: start.label,
      start_lat: start.lat,
      start_lng: start.lng,
      mode,
      length,
      starts_at: startsAt.toISOString(),
      meeting_point: stops[0].name, // defaults to the first stop
      organiser_name: name,
      plan,
    });
    if (!error) return { ok: true, id, stops: stops.length, source: plan.source };
    if (error.code !== "23505") {
      console.error("trip insert failed:", error.message);
      return { ok: false, status: 500, error: "Could not save the trip." };
    }
  }
  return { ok: false, status: 500, error: "Could not save the trip." };
}

export interface TripView {
  id: string;
  title: string;
  intro: string | null;
  mode: TravelMode;
  length: "half" | "full";
  startsAt: string;
  startLabel: string;
  meetingPoint: string;
  organiser: string;
  plan: TripPlan;
  stops: (TripStop & { plan: TripPlan["stops"][number] })[];
  joined: string[];
}

/** A trip with its stops joined to live locations (stops no longer live are left out). */
export async function getTrip(id: string): Promise<TripView | null> {
  const db = supabaseAdmin();
  const [{ data: trip, error }, { data: joins, error: joinErr }] = await Promise.all([
    db.from("trips").select("*").eq("id", id).maybeSingle(),
    db.from("trip_joins").select("first_name").eq("trip_id", id).order("created_at"),
  ]);
  if (error) throw new Error(error.message);
  if (joinErr) throw new Error(joinErr.message);
  if (!trip) return null;

  const live = await getLiveData();
  const plan = trip.plan as TripPlan;
  let here: LatLng = { lat: trip.start_lat, lng: trip.start_lng };
  const stops = plan.stops.flatMap((p) => {
    const l = live.locations.find((x) => x.id === p.location_id);
    const w = l && live.works.find((x) => x.id === l.work_id);
    if (!l || !w || l.lat === null || l.lng === null) return [];
    const at = { lat: l.lat, lng: l.lng };
    const kmFromPrevious = haversineKm(here, at);
    here = at;
    return [{
      id: l.id, workId: l.work_id, title: w.title, name: l.name, city: l.city, ...at,
      sceneNote: l.scene_note ?? null, visitNote: l.visit_note ?? null, kmFromPrevious, plan: p,
    }];
  });
  return {
    id: trip.id,
    title: trip.title,
    intro: trip.intro,
    mode: trip.mode,
    length: trip.length,
    startsAt: trip.starts_at,
    startLabel: trip.start_label,
    meetingPoint: trip.meeting_point,
    organiser: trip.organiser_name,
    plan,
    stops,
    joined: (joins ?? []).map((j) => j.first_name as string),
  };
}

export type JoinResult = "ok" | "full" | "not_found" | "bad_name";

export async function joinTrip(id: string, firstName: unknown): Promise<JoinResult> {
  const name = validateFirstName(firstName);
  if (!name) return "bad_name";
  const { data, error } = await supabaseAdmin().rpc("join_trip", { p_trip_id: id, p_first_name: name });
  if (error) throw new Error(error.message);
  return data as JoinResult;
}
