import { NextResponse } from "next/server";
import { readJson, serverError } from "@/lib/http";
import { getLiveData } from "@/lib/live-data";
import { matchTitle, normaliseTitle } from "@/lib/match";
import { supabaseAdmin } from "@/lib/supabase";

// POST {title} -> {known: workId} if we have it, else counts a request -> {requested: true}
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 1_000);
    const raw = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
    const normalised = normaliseTitle(raw);
    if (!normalised) return NextResponse.json({ error: "Type a film or series title." }, { status: 400 });

    const known = matchTitle(raw, (await getLiveData()).works);
    if (known) return NextResponse.json({ known: known.id });

    const { error } = await supabaseAdmin().rpc("add_request", { p_raw: raw, p_normalised: normalised });
    if (error) {
      console.error("request failed:", error.message);
      return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
    }
    return NextResponse.json({ requested: true }, { status: 201 });
  } catch (e) {
    return serverError("request", e);
  }
}
