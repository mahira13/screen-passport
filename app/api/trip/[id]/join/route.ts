import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { isTripId } from "@/lib/ids";
import { joinTrip } from "@/lib/trip-server";

const MESSAGES = {
  full: ["This trip is full (50 people).", 409],
  not_found: ["Unknown trip.", 404],
  bad_name: ["Add your first name (letters only, up to 30).", 400],
} as const;

// POST {firstName} -> 204
export async function POST(req: Request, ctx: RouteContext<"/api/trip/[id]/join">) {
  const { id } = await ctx.params;
  if (!isTripId(id)) return NextResponse.json({ error: MESSAGES.not_found[0] }, { status: 404 });
  const body = await readJson(req, 500);
  const result = await joinTrip(id, body?.firstName);
  if (result === "ok") return new NextResponse(null, { status: 204 });
  const [error, status] = MESSAGES[result];
  return NextResponse.json({ error }, { status });
}
