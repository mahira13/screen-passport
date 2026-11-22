"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { ADMIN_COOKIE, adminToken, isValidPassword, isValidToken } from "@/lib/admin";
import { parseLatLng } from "@/lib/distance";
import { LIVE_TAG } from "@/lib/live-data";
import { isUntrustedSource } from "@/lib/sources";
import { supabaseAdmin } from "@/lib/supabase";
import { fileFromPage } from "@/lib/images/commons";
import { NO_IMAGE, runImages } from "@/lib/images/run";
import { runVerification } from "@/lib/verify/run";

export type ActionResult = { ok: boolean; message: string };

// Server actions can be called by anyone with a POST, so each one checks the cookie.
async function requireAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!isValidToken(token)) throw new Error("Not signed in");
}

const validId = (id: unknown): id is number => Number.isInteger(id) && (id as number) > 0;

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !isValidPassword(String(form.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    return "Wrong password.";
  }
  (await cookies()).set(ADMIN_COOKIE, adminToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  return null;
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}

export async function verifyCoordinates(id: number, lat: string, lng: string): Promise<ActionResult> {
  await requireAdmin();
  const point = parseLatLng(lat, lng);
  if (!validId(id) || !point) return { ok: false, message: "Enter a valid latitude and longitude." };
  const { error } = await supabaseAdmin()
    .from("locations")
    .update({ lat: point.lat, lng: point.lng, coord_quality: "verified" })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Coordinates verified." };
}

export async function setLive(id: number): Promise<ActionResult> {
  await requireAdmin();
  if (!validId(id)) return { ok: false, message: "Unknown location." };
  const db = supabaseAdmin();
  const { data, error } = await db.from("locations").select("source_url").eq("id", id).single();
  if (error) return { ok: false, message: error.message };
  if (isUntrustedSource(data.source_url)) {
    return { ok: false, message: "Find a trusted source first (not Wikipedia or a fan wiki)." };
  }
  // Published by a person: the "Team-verified" badge. (verification_method exists from migration 008.)
  let { error: upErr } = await db.from("locations").update({ status: "live", verification_method: "team" }).eq("id", id);
  if (upErr && ["42703", "PGRST204"].includes(upErr.code)) ({ error: upErr } = await db.from("locations").update({ status: "live" }).eq("id", id));
  if (upErr) return { ok: false, message: upErr.message };
  updateTag(LIVE_TAG); // the public map shows it on the next load
  refresh();
  return { ok: true, message: "Live." };
}

// A few places per click: each needs a page fetch, a Claude call and a geocoder request (1/s).
const BATCH = 3;

export async function runAiVerification(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const s = await runVerification(supabaseAdmin(), { limit: BATCH });
    if (s.results.length === 0) return { ok: true, message: "Nothing to verify: no drafts or places marked for re-check." };
    updateTag(LIVE_TAG);
    refresh();
    const review = s.results.length - s.published - s.rejected;
    const why = Object.entries(s.needsReview).map(([r, n]) => `${n} × ${r}`).join("; ");
    return { ok: true, message: `Checked ${s.results.length}: ${s.published} published, ${review} need review, ${s.rejected} rejected.${why ? ` ${why}.` : ""}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Verification failed." };
  }
}

export async function markRecheck(id: number): Promise<ActionResult> {
  await requireAdmin();
  if (!validId(id)) return { ok: false, message: "Unknown location." };
  const { error } = await supabaseAdmin().from("locations").update({ recheck: true }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: `#${id} will be checked on the next run.` };
}

// Photos (migration 009). A few places per click: each needs up to 4 Wikimedia requests (1/s) and Claude.
export async function fetchImages(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const s = await runImages(supabaseAdmin(), { limit: 3 });
    updateTag(LIVE_TAG);
    refresh();
    if (!s.found && !s.none) return { ok: true, message: "Every published place has a photo or a decision." };
    return { ok: true, message: `Found ${s.found}: ${s.auto} auto-approved, ${s.review} need review. No photo for ${s.none}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Photo search failed." };
  }
}

// The current photo's Commons file name joins image_skip, so "Find another" never offers it again.
async function skipCurrent(id: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("locations").select("image_source_page, image_skip").eq("id", id).single();
  if (error) throw new Error(error.message);
  const skip: string[] = data.image_skip ?? [];
  const file = fileFromPage(data.image_source_page);
  return file && !skip.includes(file) ? [...skip, file] : skip;
}

export async function setImageStatus(id: number, status: "approved" | "rejected"): Promise<ActionResult> {
  await requireAdmin();
  if (!validId(id) || (status !== "approved" && status !== "rejected")) return { ok: false, message: "Unknown location." };
  try {
    const db = supabaseAdmin();
    // Approve only a photo that is there (the 009 check also requires its full credit).
    const { data, error } = status === "approved"
      ? await db.from("locations").update({ image_status: "approved" }).eq("id", id).not("image_source_page", "is", null).select("id")
      : await db.from("locations").update({ ...NO_IMAGE, image_status: "rejected", image_skip: await skipCurrent(id) }).eq("id", id).select("id");
    if (error) return { ok: false, message: error.message };
    if (!data?.length) return { ok: false, message: "No photo to decide on." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Update failed." };
  }
  updateTag(LIVE_TAG);
  refresh();
  return { ok: true, message: status === "approved" ? "Photo approved." : "Photo rejected." };
}

export async function findAnotherImage(id: number): Promise<ActionResult> {
  await requireAdmin();
  if (!validId(id)) return { ok: false, message: "Unknown location." };
  try {
    const { error } = await supabaseAdmin().from("locations").update({ ...NO_IMAGE, image_skip: await skipCurrent(id) }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    const s = await runImages(supabaseAdmin(), { ids: [id], limit: 1 });
    updateTag(LIVE_TAG);
    refresh();
    return { ok: true, message: s.lines[0] ?? "No other free photo found." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Photo search failed." };
  }
}

// Featured pins (collections.featured_rank, migration 010). Pinned collections show first on Discover,
// in rank order; the rest are scored per visitor (lib/featured.ts).
const validSlug = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id);

async function ranks() {
  const { data, error } = await supabaseAdmin().from("collections").select("id, featured_rank").not("featured_rank", "is", null).order("featured_rank");
  if (error) throw new Error(`${error.message} (is migration 010 applied?)`);
  return data as { id: string; featured_rank: number }[];
}

async function setRank(id: string, rank: number | null) {
  const { error } = await supabaseAdmin().from("collections").update({ featured_rank: rank }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function featuredAction(run: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await run();
    updateTag(LIVE_TAG);
    refresh();
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function pinCollection(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!validSlug(id)) return { ok: false, message: "Unknown collection." };
  return featuredAction(async () => {
    const r = await ranks();
    if (r.some((x) => x.id === id)) return "Already pinned.";
    await setRank(id, (r.at(-1)?.featured_rank ?? 0) + 1);
    return "Pinned at the end.";
  });
}

export async function unpinCollection(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!validSlug(id)) return { ok: false, message: "Unknown collection." };
  return featuredAction(async () => {
    await setRank(id, null);
    return "Unpinned.";
  });
}

export async function moveCollection(id: string, dir: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  if (!validSlug(id) || (dir !== "up" && dir !== "down")) return { ok: false, message: "Unknown collection." };
  return featuredAction(async () => {
    const r = await ranks();
    const i = r.findIndex((x) => x.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= r.length) return "Already at the edge.";
    // Ranks are unique: free one slot, then swap.
    await setRank(r[i].id, null);
    await setRank(r[j].id, r[i].featured_rank);
    await setRank(r[i].id, r[j].featured_rank);
    return "Moved.";
  });
}
