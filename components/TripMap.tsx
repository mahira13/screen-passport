"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

const ACCENT = "#E50914";

function numberIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${n === 1 ? ACCENT : "#F5F5F1"};color:${n === 1 ? "#fff" : "#141414"};border:2px solid #141414;box-shadow:0 1px 4px rgba(0,0,0,.35);font:700 13px var(--font-inter),system-ui,sans-serif">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Numbered stops joined by a line in visiting order. Stop 1 (the meeting point) is red. */
export default function TripMap({ stops }: { stops: (LatLng & { name: string })[] }) {
  const first = stops[0] ?? { lat: 52.52, lng: 13.405 };
  const [ref, map] = useLeafletMap({ center: [first.lat, first.lng], zoom: 13, scrollWheelZoom: false });

  useEffect(() => {
    if (!map || stops.length === 0) return;
    const points = stops.map((s) => [s.lat, s.lng] as [number, number]);
    const layer = L.layerGroup([
      L.polyline(points, { color: ACCENT, weight: 4, opacity: 0.9, dashArray: "8 8" }),
      ...stops.map((s, i) => L.marker([s.lat, s.lng], { icon: numberIcon(i + 1), title: `${i + 1}. ${s.name}`, alt: `${i + 1}. ${s.name}` })),
    ]).addTo(map);
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 16 });
    return () => {
      layer.remove();
    };
  }, [map, stops]);

  if (stops.length === 0) return null;
  return <div ref={ref} className="h-full w-full" />;
}
