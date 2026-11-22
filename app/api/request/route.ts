import { after, NextResponse } from "next/server";
import { readJson, serverError } from "@/lib/http";
import { getLiveData } from "@/lib/live-data";
import { matchTitle, normaliseTitle } from "@/lib/match";
import { startTitleSearch, workOnRequest } from "@/lib/pipeline/requests";
import { LIMITS, requestIpHash, takeRate } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

// POST {title} -> {known: workId} if we have it; otherwise the request is counted and a search for
// verified filming locations starts -> {requestId, status, text, ...}. Poll GET /api/request/<id>.
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 1_000);
    const raw = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
    const normalised = normaliseTitle(raw);
    if (!normalised) return NextResponse.json({ error: "Type a film or series title." }, { status: 400 });

    const known = matchTitle(raw, (await getLiveData()).works);
    if (known) return NextResponse.json({ known: known.id });

    const ipHash = requestIpHash(req);
    if (!(await takeRate(LIMITS.requestsPerIp, ipHash))) {
      return NextResponse.json({ error: "That's a lot of requests for one day. Try again tomorrow." }, { status: 429 });
    }
    const db = supabaseAdmin();
    const result = await startTitleSearch(db, raw, normalised, ipHash);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (!result.status.done) after(() => workOnRequest(db, result.status.requestId)); // the first batch, right away
    return NextResponse.json({ requested: true, ...result.status }, { status: result.started ? 201 : 200 });
  } catch (e) {
    return serverError("request", e);
  }
}
