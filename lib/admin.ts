import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "sp_admin";

/** Cookie value derived from ADMIN_PASSWORD, so the password itself is never stored. */
export function adminToken(password: string): string {
  return createHmac("sha256", password).update("screen-passport-admin").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** No ADMIN_PASSWORD set means admin is switched off. */
export function isValidPassword(input: string, password = process.env.ADMIN_PASSWORD): boolean {
  return !!password && safeEqual(adminToken(input), adminToken(password));
}

export function isValidToken(token: string | undefined, password = process.env.ADMIN_PASSWORD): boolean {
  return !!password && !!token && safeEqual(token, adminToken(password));
}
