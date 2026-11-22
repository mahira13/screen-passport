import { MAX_CHALLENGERS, challengeGoal, newlyFinished, standings, type Participant, type Standing } from "./challenges";
import type { CollectionModel } from "./collections-model";
import { isPassportId, randomId } from "./ids";
import { allCollections } from "./page-data";
import { editKeyMatches } from "./passport-server";
import { LIMITS, takeRate } from "./rate-limit";
import { supabaseAdmin } from "./supabase";
import { FIRST_NAME_MAX, validateFirstName } from "./trip";

export const CHALLENGE_MESSAGES = {
  name: `Add your first name: letters only, up to ${FIRST_NAME_MAX}, no links or rude words.`,
  passport: "We couldn't find your passport on this phone. Reload the page and try again.",
  collection: "This collection has no places you can check in at yet.",
  createLimit: `You've started ${LIMITS.challengesPerIp.limit} challenges today. That's the daily limit, so please try again tomorrow.`,
  joinLimit: `You've joined ${LIMITS.challengeJoinsPerIp.limit} challenges today. That's the daily limit, so please try again tomorrow.`,
  full: `This challenge is full (${MAX_CHALLENGERS} people).`,
  notFound: "Unknown challenge.",
} as const;

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** The passport must exist and the browser must hold its edit key. */
async function ownsPassport(id: unknown, editKey: unknown): Promise<boolean> {
  if (!isPassportId(id)) return false;
  const { data, error } = await supabaseAdmin().from("passports").select("edit_key_hash").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data && editKeyMatches(editKey, data.edit_key_hash);
}

/** POST body {collection, passportId, editKey, firstName}: creates the challenge and joins its creator. */
export async function createChallenge(body: Record<string, unknown>, ipHash: string): Promise<{ ok: true; id: string } | Fail> {
  const name = validateFirstName(body.firstName);
  if (!name) return fail(400, CHALLENGE_MESSAGES.name);
  const c = (await allCollections()).find((x) => x.key === body.collection);
  if (!c || challengeGoal(c.places).length === 0) return fail(400, CHALLENGE_MESSAGES.collection);
  if (!(await ownsPassport(body.passportId, body.editKey))) return fail(403, CHALLENGE_MESSAGES.passport);
  if (!(await takeRate(LIMITS.challengesPerIp, ipHash))) return fail(429, CHALLENGE_MESSAGES.createLimit);

  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId();
    const { error } = await db.from("challenges").insert({ id, collection_id: c.key, created_by_passport: body.passportId });
    if (error?.code === "23505") continue; // id taken
    if (error) throw new Error(error.message);
    await join(id, body.passportId as string, name);
    return { ok: true, id };
  }
  throw new Error("could not create a challenge id");
}

async function join(id: string, passportId: string, name: string): Promise<string> {
  const { data, error } = await supabaseAdmin().rpc("join_challenge", { p_challenge_id: id, p_passport_id: passportId, p_name: name });
  if (error) throw new Error(error.message);
  if (data === "ok" || data === "already") await markFinished(passportId); // they may have every place already
  return data as string;
}

/** POST body {passportId, editKey, firstName}. */
export async function joinChallenge(id: string, body: Record<string, unknown>, ipHash: string): Promise<{ ok: true } | Fail> {
  const name = validateFirstName(body.firstName);
  if (!name) return fail(400, CHALLENGE_MESSAGES.name);
  if (!(await ownsPassport(body.passportId, body.editKey))) return fail(403, CHALLENGE_MESSAGES.passport);
  if (!(await takeRate(LIMITS.challengeJoinsPerIp, ipHash))) return fail(429, CHALLENGE_MESSAGES.joinLimit);
  const r = await join(id, body.passportId as string, name);
  if (r === "not_found") return fail(404, CHALLENGE_MESSAGES.notFound);
  if (r === "full") return fail(409, CHALLENGE_MESSAGES.full);
  return { ok: true };
}

export type ChallengeView = {
  id: string;
  createdAt: string;
  collection: CollectionModel | null; // null: the collection is no longer published
  goal: number[];
  people: Participant[];
  visitedOf: Map<string, number[]>;
};

export async function getChallenge(id: string): Promise<ChallengeView | null> {
  const db = supabaseAdmin();
  const { data: ch, error } = await db.from("challenges").select("id, collection_id, created_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ch) return null;
  const { data: rows, error: pErr } = await db.from("challenge_participants")
    .select("passport_id, display_name, joined_at, finished_at").eq("challenge_id", id).order("joined_at");
  if (pErr) throw new Error(pErr.message);
  const people: Participant[] = (rows ?? []).map((r) => ({ passportId: r.passport_id, name: r.display_name, joinedAt: r.joined_at, finishedAt: r.finished_at }));
  const { data: ps, error: vErr } = people.length
    ? await db.from("passports").select("id, visited").in("id", people.map((p) => p.passportId))
    : { data: [], error: null };
  if (vErr) throw new Error(vErr.message);
  const collection = (await allCollections()).find((c) => c.key === ch.collection_id) ?? null;
  return {
    id: ch.id, createdAt: ch.created_at, collection, goal: collection ? challengeGoal(collection.places) : [],
    people, visitedOf: new Map((ps ?? []).map((p) => [p.id as string, (p.visited as number[]) ?? []])),
  };
}

/** Public standings: first names and counts only; passport ids never leave the server. */
export const challengeStandings = (v: ChallengeView): Standing[] => standings(v.people, v.goal, v.visitedOf);

/** After a passport's check-ins change: stamp finished_at on every challenge it has just completed. */
export async function markFinished(passportId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: open, error } = await db.from("challenge_participants")
    .select("challenge_id, challenges(collection_id)").eq("passport_id", passportId).is("finished_at", null);
  if (error) throw new Error(error.message);
  if (!open?.length) return;
  const { data: p } = await db.from("passports").select("visited").eq("id", passportId).maybeSingle();
  const all = await allCollections();
  const goals = open.map((o) => {
    const key = (o.challenges as unknown as { collection_id: string } | null)?.collection_id;
    const c = all.find((x) => x.key === key);
    return { challengeId: o.challenge_id as string, goal: c ? challengeGoal(c.places) : [] };
  });
  const done = newlyFinished(goals, (p?.visited as number[]) ?? []);
  if (!done.length) return;
  const { error: upErr } = await db.from("challenge_participants").update({ finished_at: new Date().toISOString() })
    .eq("passport_id", passportId).in("challenge_id", done).is("finished_at", null);
  if (upErr) throw new Error(upErr.message);
}
