"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import { track } from "@/lib/analytics";
import { OTHER_COLOUR } from "@/lib/colours";
import { formatDistance } from "@/lib/distance";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";
import type { LatLng } from "@/lib/types";

type Props = {
  origin: LatLng;
  places: NearbyPlace[]; // markers to draw
  focus: NearbyPlace[]; // what to zoom to
  colours: Map<string, string>;
  onReady?: () => void;
};

const NAVY = "#16213A";

function dotIcon(colour: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${colour};border:3px solid ${NAVY};box-shadow:0 0 0 2px #fff"></span>`,
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
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${ring};box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.3)"><span style="display:flex;align-items:center;justify-content:center;width:${size - 14}px;height:${size - 14}px;border-radius:50%;background:${NAVY};color:#F4EFE4;font:600 14px var(--font-inter),system-ui,sans-serif">${n}</span></span>`,
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
  const box = el("div", "", "font-family:var(--font-inter),system-ui,sans-serif;color:#16213A;min-width:180px");
  box.append(
    el("strong", p.name, "display:block;font-size:15px;line-height:1.2"),
    el("div", `${p.title} · ${formatDistance(p.distanceKm)}`, "font-size:12px;opacity:.75;margin-top:2px"),
  );
  if (p.sceneNote) box.append(el("div", p.sceneNote, "font-size:13px;margin-top:6px"));
  const a = el("a", "Directions", "display:inline-block;margin-top:8px;font-weight:600;color:#16213A;text-decoration:underline");
  Object.assign(a, { href: directionsUrl(p), target: "_blank", rel: "noopener noreferrer" });
  a.addEventListener("click", () => track("directions_clicked", { location: p.id, from: "map" }));
  box.append(a);
  return box;
}

function ClusterLayer({ places, colours }: Pick<Props, "places" | "colours">) {
  const map = useMap();
  const group = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const g = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    });
    map.addLayer(g);
    group.current = g;
    return () => {
      map.removeLayer(g);
      group.current = null;
    };
  }, [map]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    g.addLayers(
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
  }, [places, colours]);

  return null;
}

function FitTo({ origin, focus }: Pick<Props, "origin" | "focus">) {
  const map = useMap();
  useEffect(() => {
    if (focus.length === 0) {
      map.setView([origin.lat, origin.lng], 11);
      return;
    }
    const bounds = L.latLngBounds([[origin.lat, origin.lng], ...focus.map((p) => [p.lat, p.lng] as [number, number])]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, origin, focus]);
  return null;
}

export default function NearbyMap({ origin, places, focus, colours, onReady }: Props) {
  return (
    <MapContainer center={[origin.lat, origin.lng]} zoom={11} className="h-full w-full" whenReady={onReady} scrollWheelZoom={false}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ClusterLayer places={places} colours={colours} />
      <CircleMarker center={[origin.lat, origin.lng]} radius={8}
        pathOptions={{ color: NAVY, weight: 3, fillColor: "#ffffff", fillOpacity: 1 }} />
      <FitTo origin={origin} focus={focus} />
    </MapContainer>
  );
}
