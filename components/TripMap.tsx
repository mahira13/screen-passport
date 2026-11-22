"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

const GOLD = "#E3B04B";
const INK = "#16213A";
const CREAM = "#F4EFE4";

function numberIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${n === 1 ? GOLD : INK};color:${n === 1 ? INK : CREAM};border:2px solid ${n === 1 ? INK : GOLD};box-shadow:0 2px 8px rgba(0,0,0,.5);font:400 18px var(--font-bebas),system-ui,sans-serif">${n}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Numbered stops joined by a line in visiting order. Stop 1 (the meeting point) is gold. */
export default function TripMap({ stops }: { stops: (LatLng & { name: string })[] }) {
  const first = stops[0] ?? { lat: 52.52, lng: 13.405 };
  const [ref, map] = useLeafletMap({ center: [first.lat, first.lng], zoom: 13, scrollWheelZoom: false });

  useEffect(() => {
    if (!map || stops.length === 0) return;
    const points = stops.map((s) => [s.lat, s.lng] as [number, number]);
    const layer = L.layerGroup([
      L.polyline(points, { color: GOLD, weight: 3, opacity: 0.9, dashArray: "2 8", lineCap: "round" }),
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
