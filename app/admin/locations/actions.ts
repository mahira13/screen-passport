"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { ADMIN_COOKIE, adminToken, isValidPassword, isValidToken } from "@/lib/admin";
import { parseLatLng } from "@/lib/distance";
import { LIVE_TAG } from "@/lib/live-data";
import { isUntrustedSource } from "@/lib/sources";
import { supabaseAdmin } from "@/lib/supabase";
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
