"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect } from "react";
import { formatDistance, haversineKm } from "@/lib/distance";
import { initials, type MapPlace, markerLabel, type MarkerState, thumbAt } from "@/lib/explore-map";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

const GOLD = "#E3B04B";
const NAVY = "#1D2B4A";
const CREAM = "#F4EFE4";
const SIZE = 44;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Only Commons thumbnails are ever used as marker images.
const safePhoto = (p: MapPlace) => (p.photo && p.photo.url.startsWith("https://upload.wikimedia.org/") ? thumbAt(p.photo.url, 96) : null);

function markerIcon(m: MarkerState): L.DivIcon {
  const p = m.place;
  const size = m.highlighted ? SIZE + 6 : SIZE;
  const ring = `${m.highlighted ? 3 : 2}px ${p.checkIn ? "solid" : "dashed"} ${GOLD}`;
  const photo = safePhoto(p);
  const inner = photo
    ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block">`
    : `<span style="font:600 15px var(--font-grotesk),system-ui,sans-serif;color:${GOLD};letter-spacing:.04em">${esc(initials(p.titles[0]?.title ?? p.name))}</span>`;
  return L.divIcon({
    className: "",
    html: `<span role="img" aria-label="${esc(markerLabel(p))}" style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:${NAVY};border:${ring};box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:${m.faded ? 0.35 : 1};transition:transform .2s">${inner}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const placeOf = new WeakMap<L.Marker, MapPlace>();

/** A cluster shows the photo of its first place that has one (else a gold circle), with a count. */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const n = cluster.getChildCount();
  const first = cluster.getAllChildMarkers().map((m) => placeOf.get(m)).find((p) => p && safePhoto(p));
  const photo = first ? safePhoto(first) : null;
  const face = photo
    ? `<img src="${esc(photo)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="display:flex;width:100%;height:100%;border-radius:50%;background:${GOLD}"></span>`;
  const badge = `<span style="position:absolute;right:-6px;top:-6px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:${photo ? GOLD : NAVY};color:${photo ? NAVY : GOLD};font:600 12px/22px var(--font-grotesk),system-ui,sans-serif;text-align:center">${n}</span>`;
  return L.divIcon({
    className: "",
    html: `<span role="img" aria-label="${n} places" style="position:relative;display:block;width:${SIZE + 4}px;height:${SIZE + 4}px;border-radius:50%;border:2px solid ${GOLD};box-shadow:0 2px 8px rgba(0,0,0,.5)">${face}${badge}</span>`,
    iconSize: [SIZE + 4, SIZE + 4],
  });
}

// Built with textContent, never innerHTML: names and credits come from the database.
function popup(p: MapPlace, from: LatLng | null): HTMLElement {
  const el = (tag: string, text = "", style = "") => {
    const e = document.createElement(tag);
    e.textContent = text;
    if (style) e.setAttribute("style", style);
    return e;
  };
  const box = el("div", "", `font-family:var(--font-inter),system-ui,sans-serif;color:${CREAM};width:230px`);
  const photo = safePhoto(p);
  if (photo && p.photo) {
    const img = Object.assign(document.createElement("img"), { src: thumbAt(p.photo.url, 320), alt: `Photo of ${p.name}`, loading: "lazy" });
    img.setAttribute("style", "width:100%;aspect-ratio:16/9;object-fit:cover;display:block");
    const credit = Object.assign(el("a", `Photo: ${p.photo.author}, ${p.photo.license}`, `display:block;font-size:10px;color:${CREAM};opacity:.7;margin-top:2px`), { href: p.photo.page, target: "_blank", rel: "noopener noreferrer" });
    box.append(img, credit);
  }
  box.append(
    el("strong", p.name, "display:block;font:400 22px/1.05 var(--font-instrument),Georgia,serif;margin-top:6px"),
    el("div", p.titles.map((t) => t.title).join(" · "), `font-size:10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:${GOLD};margin-top:4px`),
  );
  const facts = [
    from ? formatDistance(haversineKm(from, p)) : null,
    p.verifiedBy === "ai" ? "✓ AI-verified" : p.verifiedBy === "team" ? "✓ Team-verified" : null,
    p.checkIn ? null : "Approximate location",
  ].filter(Boolean).join(" · ");
  if (facts) box.append(el("div", facts, "font-size:12px;opacity:.8;margin-top:6px"));
  box.append(Object.assign(el("a", "Open place →", `display:inline-block;margin-top:10px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};text-decoration:none`), { href: `/location/${p.id}` }));
  return box;
}

type Props = { markers: MarkerState[]; origin: LatLng; from: LatLng | null; fitKey: string };

export default function ExploreMapCanvas({ markers, origin, from, fitKey }: Props) {
  const [ref, map] = useLeafletMap({ center: [origin.lat, origin.lng], zoom: 7 });

  useEffect(() => {
    if (!map) return;
    const group = L.markerClusterGroup({ iconCreateFunction: clusterIcon, showCoverageOnHover: false, maxClusterRadius: 45, disableClusteringAtZoom: 17 });
    group.addLayers(markers.map((m) => {
      const marker = L.marker([m.place.lat, m.place.lng], { icon: markerIcon(m), title: markerLabel(m.place), keyboard: true, zIndexOffset: m.highlighted ? 1000 : 0 })
        .bindPopup(() => popup(m.place, from), { maxWidth: 260 });
      placeOf.set(marker, m.place);
      return marker;
    }));
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [map, markers, from]);

  // Zoom to what the filters show (once per filter change, not on every render).
  useEffect(() => {
    if (!map) return;
    const pts = markers.filter((m) => !m.faded).map((m) => [m.place.lat, m.place.lng] as [number, number]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
    else map.setView([origin.lat, origin.lng], 7);
  }, [map, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps -- refit only when the filters change

  return <div ref={ref} className="h-full w-full bg-surface" />;
}
