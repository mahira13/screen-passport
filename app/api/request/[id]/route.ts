import { after, NextResponse } from "next/server";
import { serverError } from "@/lib/http";
import { requestStatus, workOnRequest } from "@/lib/pipeline/requests";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

// GET /api/request/<id> -> the search status (queued, searching, found N, nothing). The page polls
// this every few seconds; while the search runs, each call also works on its next jobs after
// answering, so a request never waits for the hourly cron.
export async function GET(_req: Request, ctx: RouteContext<"/api/request/[id]">) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
    const db = supabaseAdmin();
    const status = await requestStatus(db, id);
    if (!status) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
    if (!status.done) after(() => workOnRequest(db, id));
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("request status", e);
  }
}
