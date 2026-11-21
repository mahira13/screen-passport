import { createHash, timingSafeEqual } from "node:crypto";

export function hashEditKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function editKeyMatches(key: unknown, storedHash: string | null): boolean {
  if (typeof key !== "string" || !storedHash) return false;
  const a = Buffer.from(hashEditKey(key));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
