import { createHash } from "node:crypto";
import { clientIp, hashIp } from "./client-ip";
import { supabaseAdmin } from "./supabase";

export const LIMITS = {
  tripsPerIp: { bucket: "trip", limit: 5, window: "1 day" },
  claudeGlobal: { bucket: "claude", limit: 300, window: "1 day" },
  joinsPerIp: { bucket: "join", limit: 20, window: "1 day" },
  reportsPerIp: { bucket: "report", limit: 20, window: "1 day" },
  // On-demand title searches (each can make several AI calls): per visitor and in total.
  titleSearchPerIp: { bucket: "title_search", limit: 5, window: "1 day" },
  titleSearchGlobal: { bucket: "title_search_all", limit: 200, window: "1 day" },
} as const;

type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** RATE_LIMIT_SALT if set; otherwise derived from the (secret, server-only) service role key. */
function salt(): string {
  const s = process.env.RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing env var RATE_LIMIT_SALT or SUPABASE_SERVICE_ROLE_KEY");
  return createHash("sha256").update(`rate-limit:${s}`).digest("hex");
}

export function requestIpHash(req: Request): string {
  return hashIp(clientIp(req.headers), salt());
}

/**
 * Per-IP limits are skipped in local dev and when RATE_LIMITS=off (for testing; never set it in
 * production). The global caps always apply: they protect the bill.
 */
export function perIpLimitsOff(env: Record<string, string | undefined> = process.env): boolean {
  return env.RATE_LIMITS === "off" || env.NODE_ENV === "development";
}

/** True if the call may go ahead (and counts it). key: an IP hash, or "global". */
export async function takeRate(limit: Limit, key: string): Promise<boolean> {
  if (limit !== LIMITS.claudeGlobal && limit !== LIMITS.titleSearchGlobal && perIpLimitsOff()) return true;
  const { data, error } = await supabaseAdmin().rpc("take_rate", {
    p_bucket: limit.bucket, p_key: key, p_limit: limit.limit, p_window: limit.window,
  });
  if (error) throw new Error(`rate limit: ${error.message}`);
  return data === true;
}
