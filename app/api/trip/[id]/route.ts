import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { isTripId } from "@/lib/ids";
import { deleteTrip } from "@/lib/trip-server";

// DELETE {key} -> 204. key is the organiser's secret from creation.
export async function DELETE(req: Request, ctx: RouteContext<"/api/trip/[id]">) {
  const { id } = await ctx.params;
  if (!isTripId(id)) return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
  const body = await readJson(req, 500);
  const result = await deleteTrip(id, body?.key);
  if (result === "ok") return new NextResponse(null, { status: 204 });
  if (result === "forbidden") return NextResponse.json({ error: "That organiser link isn't valid for this trip." }, { status: 403 });
  return NextResponse.json({ error: "Unknown trip." }, { status: 404 });
}
