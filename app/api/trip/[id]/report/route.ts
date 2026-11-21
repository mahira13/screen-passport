import { NextResponse } from "next/server";
import { isTripId } from "@/lib/ids";
import { requestIpHash } from "@/lib/rate-limit";
import { MESSAGES, reportTrip } from "@/lib/trip-server";

// POST -> 204. One report per IP per trip counts; three hide the trip.
export async function POST(req: Request, ctx: RouteContext<"/api/trip/[id]/report">) {
  const { id } = await ctx.params;
  if (!isTripId(id)) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
  const result = await reportTrip(id, requestIpHash(req));
  if (result === "limit") return NextResponse.json({ error: MESSAGES.reportLimit }, { status: 429 });
  if (result === "not_found") return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
