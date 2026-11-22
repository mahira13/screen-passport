"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { OTHER_COLOUR } from "@/lib/colours";
import { formatDistance } from "@/lib/distance";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

type Props = {
  origin: LatLng;
  places: NearbyPlace[]; // markers to draw
  focus: NearbyPlace[]; // what to zoom to
  colours: Map<string, string>;
  onReady?: () => void;
};

const INK = "#16213A"; // marker ring, matches the page background
const CREAM = "#F4EFE4";
const GOLD = "#E3B04B";

function dotIcon(colour: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${colour};border:3px solid ${INK};box-shadow:0 0 0 2px ${GOLD},0 2px 8px rgba(0,0,0,.5)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

// Which colour each marker has, so a cluster can show the mix of titles inside it.
const markerColour = new WeakMap<L.Marker, string>();

/** "conic-gradient(#a 0deg 120deg, #b 120deg 360deg)": one slice per colour, sized by count. */
function colourRing(colours: string[]): string {
  const counts = new Map<string, number>();
  for (const c of colours) counts.set(c, (counts.get(c) ?? 0) + 1);
  let start = 0;
  const slices = [...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => {
    const end = start + (n / colours.length) * 360;
    const slice = `${c} ${start}deg ${end}deg`;
    start = end;
    return slice;
  });
  return `conic-gradient(${slices.join(",")})`;
}

function clusterIcon(cluster: L.MarkerCluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 38 : n < 30 ? 44 : 50;
  const ring = colourRing(cluster.getAllChildMarkers().map((m) => markerColour.get(m) ?? OTHER_COLOUR));
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${ring};box-shadow:0 0 0 2px ${GOLD},0 2px 8px rgba(0,0,0,.5)"><span style="display:flex;align-items:center;justify-content:center;width:${size - 14}px;height:${size - 14}px;border-radius:50%;background:${INK};color:${CREAM};font:600 15px var(--font-grotesk),system-ui,sans-serif;letter-spacing:.04em">${n}</span></span>`,
    iconSize: [size, size],
  });
}

// Built with textContent, never innerHTML: notes come from the database.
function popupContent(p: NearbyPlace): HTMLElement {
  const el = (tag: string, text: string, style = "") => {
    const e = document.createElement(tag);
    e.textContent = text;
    if (style) e.setAttribute("style", style);
    return e;
  };
  const box = el("div", "", `font-family:var(--font-inter),system-ui,sans-serif;color:${CREAM};min-width:190px;max-width:240px`);
  box.append(
    el("div", `${p.title} · ${formatDistance(p.distanceKm)}`,
      `font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${GOLD}`),
    el("strong", p.name, "display:block;font:600 20px/1.1 var(--font-grotesk),system-ui,sans-serif;margin-top:4px"),
  );
  if (p.sceneNote) box.append(el("div", p.sceneNote, "font:14px/1.35 var(--font-inter),system-ui,sans-serif;margin-top:6px;opacity:.8"));
  const a = el("a", "Directions →",
    `display:inline-block;margin-top:10px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};text-decoration:none`);
  Object.assign(a, { href: directionsUrl(p), target: "_blank", rel: "noopener noreferrer" });
  a.addEventListener("click", () => track("directions_clicked", { location: p.id, from: "map" }));
  box.append(a);
  return box;
}

export default function NearbyMap({ origin, places, focus, colours, onReady }: Props) {
  const [ref, map] = useLeafletMap({ center: [origin.lat, origin.lng], zoom: 11, scrollWheelZoom: false });

  useEffect(() => {
    if (map) onReady?.();
  }, [map, onReady]);

  // Markers, clustered; a cluster's ring shows the mix of titles inside it.
  useEffect(() => {
    if (!map) return;
    const group = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    });
    group.addLayers(
      places.map((p) => {
        const colour = colours.get(p.workId) ?? OTHER_COLOUR;
        const m = L.marker([p.lat, p.lng], {
          icon: dotIcon(colour),
          title: `${p.name} (${p.title})`,
          alt: `${p.name} (${p.title})`,
        }).bindPopup(() => popupContent(p));
        markerColour.set(m, colour);
        return m;
      }),
    );
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, places, colours]);

  // The start point.
  useEffect(() => {
    if (!map) return;
    const start = L.circleMarker([origin.lat, origin.lng], {
      radius: 9, color: GOLD, weight: 4, fillColor: INK, fillOpacity: 1,
    }).addTo(map);
    return () => {
      start.remove();
    };
  }, [map, origin]);

  // Zoom to what matters: the start plus the places in focus.
  useEffect(() => {
    if (!map) return;
    if (focus.length === 0) {
      map.setView([origin.lat, origin.lng], 11);
      return;
    }
    const bounds = L.latLngBounds([[origin.lat, origin.lng], ...focus.map((p) => [p.lat, p.lng] as [number, number])]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, origin, focus]);

  return <div ref={ref} className="h-full w-full" />;
}
