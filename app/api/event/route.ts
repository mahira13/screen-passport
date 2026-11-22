import { NextResponse } from "next/server";
import { cleanProps, isEventName } from "@/lib/analytics";
import { LIMITS, requestIpHash, takeRate } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/event {name, props} -> one row in `events`. Nothing about the caller is stored;
// the IP hash is only used for the rate limit.
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 2000) return new NextResponse(null, { status: 413 });
  let body: { name?: unknown; props?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!isEventName(body.name)) return new NextResponse(null, { status: 400 });

  try {
    if (!(await takeRate(LIMITS.eventsPerIp, requestIpHash(req)))) return new NextResponse(null, { status: 429 });
    const { error } = await supabaseAdmin().from("events").insert({ name: body.name, props: cleanProps(body.props) });
    if (error) throw new Error(error.message);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("event insert failed:", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500 });
  }
}
