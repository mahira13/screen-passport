import { NextResponse } from "next/server";
import { readJson, serverError } from "@/lib/http";
import { isTripId } from "@/lib/ids";
import { tripSummaries } from "@/lib/trip-server";

// POST {ids} -> {trips}. The browser sends the trip IDs it remembers; nothing is stored.
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 3_000);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string" && isTripId(x)).slice(0, 50) : [];
    return NextResponse.json({ trips: await tripSummaries(ids) });
  } catch (e) {
    return serverError("my trips", e);
  }
}
