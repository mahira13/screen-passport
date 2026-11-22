import { haversineKm } from "./distance";
import { randomEditKey, randomId } from "./ids";
import { getCities } from "./cities-server";
import { getLiveData } from "./live-data";
import { editKeyMatches, hashEditKey } from "./passport-server";
import { LIMITS, takeRate } from "./rate-limit";
import type { TravelMode } from "./route";
import { supabaseAdmin } from "./supabase";
import {
  DEFAULT_TIME_ZONE, isTravelMode, isTripLength, isValidTimeZone, nearestCity, parseFrom, parseStartsAt,
  codePlan, parseWorkIds, selectTripStops, validateFirstName, validateMeetingPoint, type TripPlan, type TripStop,
} from "./trip";
import { writeTripPlan } from "./trip-ai";
import type { LatLng } from "./types";

export const MESSAGES = {
  tripLimit: "You've created 5 trips today. That's the daily limit, so please try again tomorrow.",
  joinLimit: "You've joined 20 trips today. That's the daily limit, so please try again tomorrow.",
  reportLimit: "Thanks, you've sent a lot of reports today. Please try again tomorrow.",
  name: "Add your first name: letters only, up to 30, no links or rude words.",
  meetingPoint: "Pick a different meeting point: up to 200 characters, no links or rude words.",
};

export type CreateResult =
  | { ok: true; id: string; deleteKey: string; stops: number; source: TripPlan["source"] }
  | { ok: false; status: number; error: string; nearestCity?: string | null };

/** Validates the form, picks stops in code, lets Claude write the words (within the daily cap), saves. */
export async function createTrip(body: Record<string, unknown>, ipHash: string): Promise<CreateResult> {
  const workIds = parseWorkIds(Array.isArray(body.works) ? body.works.join(",") : String(body.works ?? ""));
  const start = parseFrom(typeof body.from === "string" ? body.from : null, await getCities());
  // A picked city has its own zone; a shared location uses the browser's.
  const tz = start?.tz ?? (isValidTimeZone(body.timeZone) ? body.timeZone : DEFAULT_TIME_ZONE);
  const startsAt = parseStartsAt(body.startsLocal, tz);
  const name = validateFirstName(body.firstName);
  const meetingPoint = validateMeetingPoint(body.meetingPoint);
  const { mode, length } = body;
  if (!workIds.length || !start || !isTravelMode(mode) || !isTripLength(length))
    return { ok: false, status: 400, error: "Pick at least one title, a start, a mode and a length." };
  if (!startsAt) return { ok: false, status: 400, error: "Pick a date and time from today on." };
  if (!name) return { ok: false, status: 400, error: MESSAGES.name };
  if (meetingPoint === null) return { ok: false, status: 400, error: MESSAGES.meetingPoint };

  const live = await getLiveData();
  const known = workIds.filter((id) => live.works.some((w) => w.id === id));
  const stops = selectTripStops(live.locations, live.works, known, start, mode, length);
  if (stops.length === 0)
    return { ok: false, status: 422, error: "none_in_range", nearestCity: nearestCity(live.locations, known, start) };

  if (!(await takeRate(LIMITS.tripsPerIp, ipHash))) return { ok: false, status: 429, error: MESSAGES.tripLimit };
  const ctx = { start, mode, length, startsAt: startsAt.toISOString(), tz };
  // Past the daily cap of Claude generations, trips get the plain plan.
  const plan = (await takeRate(LIMITS.claudeGlobal, "global")) ? await writeTripPlan(stops, ctx) : codePlan(stops, start, mode);

  const deleteKey = randomEditKey();
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
      timezone: tz,
      meeting_point: meetingPoint || stops[0].name, // defaults to the first stop
      organiser_name: name,
      plan,
      delete_key_hash: hashEditKey(deleteKey),
    });
    if (!error) return { ok: true, id, deleteKey, stops: stops.length, source: plan.source };
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
  timeZone: string;
  startLabel: string;
  meetingPoint: string;
  meetingIsFirstStop: boolean;
  organiser: string;
  plan: TripPlan;
  stops: (TripStop & { plan: TripPlan["stops"][number] })[];
  joined: string[];
}

/** A visible trip with its stops joined to live locations (stops no longer live are left out). */
export async function getTrip(id: string): Promise<TripView | null> {
  const db = supabaseAdmin();
  const [{ data: trip, error }, { data: joins, error: joinErr }] = await Promise.all([
    db.from("trips").select("*").eq("id", id).is("hidden_at", null).maybeSingle(),
    db.from("trip_joins").select("first_name").eq("trip_id", id).order("created_at"),
  ]);
  if (error) throw new Error(error.message);
  if (joinErr) throw new Error(joinErr.message);
  if (!trip) return null;

  const live = await getLiveData();
  const plan = trip.plan as TripPlan;
  let here: LatLng = { lat: trip.start_lat, lng: trip.start_lng };
  const stops = plan.stops.flatMap((p) => {
    // A place can belong to several titles: prefer the entry for one of this trip's titles.
    const l = live.locations.find((x) => x.id === p.location_id && trip.work_ids?.includes(x.work_id))
      ?? live.locations.find((x) => x.id === p.location_id);
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
    timeZone: isValidTimeZone(trip.timezone) ? trip.timezone : DEFAULT_TIME_ZONE,
    startLabel: trip.start_label,
    meetingPoint: trip.meeting_point,
    meetingIsFirstStop: stops[0]?.name === trip.meeting_point,
    organiser: trip.organiser_name,
    plan,
    stops,
    joined: (joins ?? []).map((j) => j.first_name as string),
  };
}

export type JoinResult = "ok" | "full" | "not_found" | "bad_name" | "limit";

export async function joinTrip(id: string, firstName: unknown, ipHash: string): Promise<JoinResult> {
  const name = validateFirstName(firstName);
  if (!name) return "bad_name";
  if (!(await takeRate(LIMITS.joinsPerIp, ipHash))) return "limit";
  const { data, error } = await supabaseAdmin().rpc("join_trip", { p_trip_id: id, p_first_name: name });
  if (error) throw new Error(error.message);
  return data as JoinResult;
}

export async function reportTrip(id: string, ipHash: string): Promise<"ok" | "not_found" | "limit"> {
  if (!(await takeRate(LIMITS.reportsPerIp, ipHash))) return "limit";
  const { data, error } = await supabaseAdmin().rpc("report_trip", { p_trip_id: id, p_ip_hash: ipHash });
  if (error) throw new Error(error.message);
  return data as "ok" | "not_found";
}

/** Deletes a trip (and its joins and reports) if the organiser's secret key matches. */
export async function deleteTrip(id: string, key: unknown): Promise<"ok" | "not_found" | "forbidden"> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("trips").select("delete_key_hash").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "not_found";
  if (!editKeyMatches(key, data.delete_key_hash)) return "forbidden";
  const { error: delErr } = await db.from("trips").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);
  return "ok";
}
