import { NextResponse } from "next/server";
import { cleanProps, isEventName } from "@/lib/analytics";
import { supabasePublic } from "@/lib/supabase";

// POST /api/event {name, props} -> one row in `events` (insert-only for the public).
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

  const { error } = await supabasePublic().from("events").insert({ name: body.name, props: cleanProps(body.props) });
  if (error) console.error("event insert failed:", error.message);
  return new NextResponse(null, { status: error ? 500 : 204 });
}
