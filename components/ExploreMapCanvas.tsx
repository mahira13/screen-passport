"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect } from "react";
import { formatDistance, haversineKm } from "@/lib/distance";
import { type MapPlace, markerLabel, type MarkerState, thumbAt } from "@/lib/explore-map";
import { clusterHtml, GOLD, MARKER_SIZE, markerHtml, markerThumb } from "@/lib/map-markers";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

const CREAM = "#F4EFE4";
const SIZE = MARKER_SIZE;

const photoOfPlace = (p: MapPlace) => markerThumb(p.photo?.url);

function markerIcon(m: MarkerState): L.DivIcon {
  const p = m.place;
  const size = m.highlighted ? SIZE + 6 : SIZE;
  return L.divIcon({
    className: "",
    html: markerHtml({ thumb: photoOfPlace(p), label: p.titles[0]?.title ?? p.name, aria: markerLabel(p), size, ring: m.highlighted ? 3 : 2, dashed: !p.checkIn, faded: m.faded }),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const placeOf = new WeakMap<L.Marker, MapPlace>();

/** A cluster shows the photo of its first place that has one, with the count. */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const thumb = cluster.getAllChildMarkers().map((m) => placeOf.get(m)).map((p) => (p ? photoOfPlace(p) : null)).find(Boolean) ?? null;
  return L.divIcon({ className: "", html: clusterHtml(thumb, cluster.getChildCount()), iconSize: [SIZE + 4, SIZE + 4] });
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
  if (photoOfPlace(p) && p.photo) {
    const img = Object.assign(document.createElement("img"), { src: thumbAt(p.photo.url, 460), alt: `Photo of ${p.name}`, loading: "lazy" });
    img.setAttribute("style", "width:100%;aspect-ratio:16/9;object-fit:cover;display:block");
    const credit = Object.assign(el("a", `Photo: ${p.photo.author}, ${p.photo.license}`, `display:block;font-size:10px;color:${CREAM};opacity:.7;margin-top:2px`), { href: p.photo.page, target: "_blank", rel: "noopener noreferrer" });
    box.append(img, credit);
  }
  box.append(
    el("strong", p.name, "display:block;font:600 20px/1.1 var(--font-grotesk),system-ui,sans-serif;margin-top:6px"),
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
