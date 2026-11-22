export const EVENT_NAMES = [
  "map_viewed", "title_watched", "passport_created", "share_clicked", "checkin_success",
  "postcard_made", "layla_clicked", "directions_clicked", "request_created", "screenshot_read",
  "trip_created", "trip_joined", "trip_shared", "invite_shared", "challenge_created", "challenge_joined",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export type EventProps = Record<string, string | number | boolean>;

export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && (EVENT_NAMES as readonly string[]).includes(x);
}

/** Keeps only flat string/number/boolean props, short keys and values. Never send personal data. */
export function cleanProps(props: unknown): EventProps {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props).slice(0, 10)) {
    if (k.length > 40) continue;
    if (typeof v === "string") out[k] = v.slice(0, 100);
    else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Fire-and-forget from the browser; failures never affect the page. */
export function track(name: EventName, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, props }),
    keepalive: true,
  }).catch(() => {});
}
