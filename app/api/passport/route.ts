import { NextResponse } from "next/server";
import { isPassportId, randomEditKey, randomId } from "@/lib/ids";
import { getLiveData } from "@/lib/live-data";
import { cleanStartCity, cleanWatched } from "@/lib/passport";
import { editKeyMatches, hashEditKey } from "@/lib/passport-server";
import { supabaseAdmin } from "@/lib/supabase";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 10_000) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

async function knownWorkIds() {
  return new Set((await getLiveData()).works.map((w) => w.id));
}

// POST {watched, startCity} -> {id, editKey}. The browser keeps editKey; we store its hash.
export async function POST(req: Request) {
  const body = await readJson(req);
  const watched = body && cleanWatched(body.watched, await knownWorkIds());
  if (!body || !watched) return bad("Send {watched: [...]}.");

  const editKey = randomEditKey();
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId();
    const { error } = await db.from("passports").insert({
      id,
      watched,
      start_city: cleanStartCity(body.startCity),
      edit_key_hash: hashEditKey(editKey),
    });
    if (!error) return NextResponse.json({ id, editKey }, { status: 201 });
    if (error.code !== "23505") return bad(error.message, 500); // 23505: id taken, try another
  }
  return bad("Could not create a passport.", 500);
}

// PATCH {id, editKey, watched} -> 204
export async function PATCH(req: Request) {
  const body = await readJson(req);
  if (!body || !isPassportId(body.id)) return bad("Unknown passport.", 404);
  const watched = cleanWatched(body.watched, await knownWorkIds());
  if (!watched) return bad("Send {watched: [...]}.");

  const db = supabaseAdmin();
  const { data, error } = await db.from("passports").select("edit_key_hash").eq("id", body.id).maybeSingle();
  if (error) return bad(error.message, 500);
  if (!data) return bad("Unknown passport.", 404);
  if (!editKeyMatches(body.editKey, data.edit_key_hash)) return bad("Not allowed.", 403);

  const { error: upErr } = await db.from("passports").update({ watched }).eq("id", body.id);
  if (upErr) return bad(upErr.message, 500);
  return new NextResponse(null, { status: 204 });
}
