import { after, NextResponse } from "next/server";
import { markFinished } from "@/lib/challenges-server";
import { isPassportId, randomEditKey, randomId } from "@/lib/ids";
import { deriveCities } from "@/lib/cities";
import { getLiveData } from "@/lib/live-data";
import { checkInIds, cleanStartCity, cleanVisited, cleanWatched } from "@/lib/passport";
import { editKeyMatches, hashEditKey } from "@/lib/passport-server";
import { LIMITS, requestIpHash, takeRate } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const LIMITED = "Too many saves from this connection today. Try again tomorrow.";

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

async function catalogue() {
  const live = await getLiveData();
  return { works: new Set(live.works.map((w) => w.id)), checkIn: checkInIds(live.locations), cities: deriveCities(live.locations) };
}

// POST {watched, visited?, startCity} -> {id, editKey}. The browser keeps editKey; we store its hash.
export async function POST(req: Request) {
  if (!(await takeRate(LIMITS.passportCreatesPerIp, requestIpHash(req)))) return bad(LIMITED, 429);
  const body = await readJson(req);
  const known = await catalogue();
  const watched = body && cleanWatched(body.watched, known.works);
  const visited = body && (body.visited === undefined ? [] : cleanVisited(body.visited, known.checkIn, []));
  if (!body || !watched || !visited) return bad("Send {watched: [...], visited: [...]}.");

  const editKey = randomEditKey();
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId();
    const { error } = await db.from("passports").insert({
      id,
      watched,
      visited,
      start_city: cleanStartCity(body.startCity, known.cities),
      edit_key_hash: hashEditKey(editKey),
    });
    if (!error) return NextResponse.json({ id, editKey }, { status: 201 });
    if (error.code !== "23505") return bad(error.message, 500); // 23505: id taken, try another
  }
  return bad("Could not create a passport.", 500);
}

// PATCH {id, editKey, watched, visited?} -> 204. Without visited (older pages) check-ins stay as they are.
export async function PATCH(req: Request) {
  if (!(await takeRate(LIMITS.passportSavesPerIp, requestIpHash(req)))) return bad(LIMITED, 429);
  const body = await readJson(req);
  if (!body || !isPassportId(body.id)) return bad("Unknown passport.", 404);
  const known = await catalogue();
  const watched = cleanWatched(body.watched, known.works);
  if (!watched) return bad("Send {watched: [...]}.");

  const db = supabaseAdmin();
  const { data, error } = await db.from("passports").select("edit_key_hash, visited").eq("id", body.id).maybeSingle();
  if (error) return bad(error.message, 500);
  if (!data) return bad("Unknown passport.", 404);
  if (!editKeyMatches(body.editKey, data.edit_key_hash)) return bad("Not allowed.", 403);

  const visited = body.visited === undefined ? data.visited : cleanVisited(body.visited, known.checkIn, data.visited ?? []);
  if (!visited) return bad("Send visited as a list of place ids.");
  const { error: upErr } = await db.from("passports").update({ watched, visited }).eq("id", body.id);
  if (upErr) return bad(upErr.message, 500);
  if (visited.length > (data.visited ?? []).length) {
    const id = body.id as string;
    after(() => markFinished(id).catch((e) => console.error("challenge finish:", e instanceof Error ? e.message : e)));
  }
  return new NextResponse(null, { status: 204 });
}
