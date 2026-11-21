import { clientIp, hashIp } from "./client-ip";
import { supabaseAdmin } from "./supabase";

export const LIMITS = {
  tripsPerIp: { bucket: "trip", limit: 5, window: "1 day" },
  claudeGlobal: { bucket: "claude", limit: 300, window: "1 day" },
  joinsPerIp: { bucket: "join", limit: 20, window: "1 day" },
  reportsPerIp: { bucket: "report", limit: 20, window: "1 day" },
} as const;

type Limit = (typeof LIMITS)[keyof typeof LIMITS];

function salt(): string {
  const s = process.env.RATE_LIMIT_SALT;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Missing env var RATE_LIMIT_SALT");
  return "dev-only-salt";
}

export function requestIpHash(req: Request): string {
  return hashIp(clientIp(req.headers), salt());
}

/** True if the call may go ahead (and counts it). key: an IP hash, or "global". */
export async function takeRate(limit: Limit, key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("take_rate", {
    p_bucket: limit.bucket, p_key: key, p_limit: limit.limit, p_window: limit.window,
  });
  if (error) throw new Error(`rate limit: ${error.message}`);
  return data === true;
}
