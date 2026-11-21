import { NextResponse } from "next/server";
import { readJson, serverError } from "@/lib/http";
import { isTripId } from "@/lib/ids";
import { requestIpHash } from "@/lib/rate-limit";
import { joinTrip, MESSAGES as M } from "@/lib/trip-server";

const MESSAGES = {
  full: ["This trip is full (50 people).", 409],
  not_found: ["Unknown trip.", 404],
  bad_name: [M.name, 400],
  limit: [M.joinLimit, 429],
} as const;

// POST {firstName} -> 204
export async function POST(req: Request, ctx: RouteContext<"/api/trip/[id]/join">) {
  try {
    const { id } = await ctx.params;
    if (!isTripId(id)) return NextResponse.json({ error: MESSAGES.not_found[0] }, { status: 404 });
    const body = await readJson(req, 500);
    const result = await joinTrip(id, body?.firstName, requestIpHash(req));
    if (result === "ok") return new NextResponse(null, { status: 204 });
    const [error, status] = MESSAGES[result];
    return NextResponse.json({ error }, { status });
  } catch (e) {
    return serverError("join trip", e);
  }
}
