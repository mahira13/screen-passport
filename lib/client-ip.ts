import { createHash } from "node:crypto";

/** The caller's IP as Vercel passes it: first x-forwarded-for entry, else x-real-ip. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted sha256 (64 hex chars). The raw IP is never stored. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
