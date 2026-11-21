import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { requestIpHash } from "@/lib/rate-limit";
import { createTrip } from "@/lib/trip-server";

export const maxDuration = 60; // two Claude attempts at most

// POST {works, from, mode, length, startsLocal, timeZone, firstName, meetingPoint?}
//   -> {id, deleteKey} | {error, nearestCity?}
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Send the trip form as JSON." }, { status: 400 });
  const res = await createTrip(body, requestIpHash(req));
  if (!res.ok) return NextResponse.json({ error: res.error, nearestCity: res.nearestCity }, { status: res.status });
  return NextResponse.json({ id: res.id, deleteKey: res.deleteKey, stops: res.stops, source: res.source }, { status: 201 });
}
