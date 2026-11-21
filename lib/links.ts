import type { LatLng } from "./types";

/** Google Maps directions to a point (official Maps URLs format, no API key). */
export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`;
}
