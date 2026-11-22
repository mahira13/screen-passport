"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { OTHER_COLOUR } from "@/lib/colours";
import { clusterHtml, MARKER_SIZE, markerHtml, markerThumb } from "@/lib/map-markers";
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

function placeIcon(p: NearbyPlace, colour: string) {
  return L.divIcon({
    className: "",
    html: markerHtml({ thumb: markerThumb(p.photo?.url), label: p.title, aria: `${p.name} (${p.title})`, dot: colour }),
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    popupAnchor: [0, -MARKER_SIZE / 2],
  });
}

// Each marker's photo, so a cluster can show one of them.
const markerPhoto = new WeakMap<L.Marker, string | null>();

/** One photo from inside the cluster (the first that has one) and the count. */
function clusterIcon(cluster: L.MarkerCluster) {
  const thumb = cluster.getAllChildMarkers().map((m) => markerPhoto.get(m) ?? null).find(Boolean) ?? null;
  return L.divIcon({ className: "", html: clusterHtml(thumb, cluster.getChildCount()), iconSize: [MARKER_SIZE + 4, MARKER_SIZE + 4] });
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

  // Photo markers (title colour as a small dot), clustered.
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
          icon: placeIcon(p, colour),
          title: `${p.name} (${p.title})`,
          alt: `${p.name} (${p.title})`,
        }).bindPopup(() => popupContent(p));
        markerPhoto.set(m, markerThumb(p.photo?.url));
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
