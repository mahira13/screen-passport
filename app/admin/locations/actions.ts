"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { ADMIN_COOKIE, adminToken, isValidPassword, isValidToken } from "@/lib/admin";
import { parseLatLng } from "@/lib/distance";
import { LIVE_TAG } from "@/lib/live-data";
import { isUntrustedSource } from "@/lib/sources";
import { supabaseAdmin } from "@/lib/supabase";

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
  const { error: upErr } = await db.from("locations").update({ status: "live" }).eq("id", id);
  if (upErr) return { ok: false, message: upErr.message };
  updateTag(LIVE_TAG); // the public map shows it on the next load
  refresh();
  return { ok: true, message: "Live." };
}
