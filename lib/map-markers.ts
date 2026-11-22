// Marker HTML for the Leaflet maps: a round Commons photo with a gold ring, or the title's
// initials as the fallback; clusters show one photo and the count. Pure (strings only).
import { initials, thumbAt } from "./explore-map";

export const GOLD = "#E3B04B";
export const NAVY = "#1D2B4A";
export const MARKER_SIZE = 44;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Only Commons thumbnails become marker images, at twice the marker size for sharp screens. */
export function markerThumb(url: string | null | undefined, size = MARKER_SIZE): string | null {
  return url && /^https:\/\/upload\.wikimedia\.org\//.test(url) ? thumbAt(url, size * 2) : null;
}

type Marker = {
  thumb: string | null; // from markerThumb
  label: string; // initials come from this
  aria: string;
  size?: number;
  ring?: number; // ring width
  dashed?: boolean; // approximate places
  faded?: boolean;
  dot?: string; // small colour dot (the title's colour on Discover)
};

export function markerHtml({ thumb, label, aria, size = MARKER_SIZE, ring = 2, dashed = false, faded = false, dot }: Marker): string {
  const face = thumb
    ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%">`
    : `<span style="font:600 ${Math.round(size / 3)}px var(--font-grotesk),system-ui,sans-serif;color:${GOLD};letter-spacing:.04em">${esc(initials(label))}</span>`;
  const badge = dot
    ? `<span style="position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;background:${esc(dot)};border:2px solid ${NAVY}"></span>`
    : "";
  return `<span role="img" aria-label="${esc(aria)}" style="position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;background:${NAVY};border:${ring}px ${dashed ? "dashed" : "solid"} ${GOLD};box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:${faded ? 0.35 : 1}">${face}${badge}</span>`;
}

export function clusterHtml(thumb: string | null, count: number, size = MARKER_SIZE + 4): string {
  const face = thumb
    ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%">`
    : `<span style="display:block;width:100%;height:100%;border-radius:50%;background:${NAVY}"></span>`;
  const badge = `<span style="position:absolute;right:-6px;top:-6px;min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;border-radius:11px;background:${GOLD};color:${NAVY};font:600 12px/22px var(--font-grotesk),system-ui,sans-serif;text-align:center">${count}</span>`;
  return `<span role="img" aria-label="${count} places" style="position:relative;display:block;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${GOLD};background:${NAVY};box-shadow:0 2px 8px rgba(0,0,0,.5)">${face}${badge}</span>`;
}
