"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { LatLng } from "@/lib/types";

const ACCENT = "#E50914";

function numberIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${n === 1 ? ACCENT : "#F5F5F1"};color:${n === 1 ? "#fff" : "#141414"};border:2px solid #141414;box-shadow:0 1px 4px rgba(0,0,0,.35);font:700 13px var(--font-inter),system-ui,sans-serif">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function Fit({ stops }: { stops: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 1) map.setView([stops[0].lat, stops[0].lng], 15);
    else map.fitBounds(L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number])), { padding: [32, 32], maxZoom: 16 });
  }, [map, stops]);
  return null;
}

/** Numbered stops joined by a line in visiting order. Stop 1 (the meeting point) is red. */
export default function TripMap({ stops }: { stops: (LatLng & { name: string })[] }) {
  if (stops.length === 0) return null;
  return (
    <MapContainer center={[stops[0].lat, stops[0].lng]} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polyline positions={stops.map((s) => [s.lat, s.lng] as [number, number])}
        pathOptions={{ color: ACCENT, weight: 4, opacity: 0.9, dashArray: "8 8" }} />
      {stops.map((s, i) => (
        <Marker key={i} position={[s.lat, s.lng]} icon={numberIcon(i + 1)} title={`${i + 1}. ${s.name}`} alt={`${i + 1}. ${s.name}`} />
      ))}
      <Fit stops={stops} />
    </MapContainer>
  );
}
