"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import type { LatLng } from "@/lib/types";
import { useLeafletMap } from "@/lib/use-leaflet-map";

export type MapPin = LatLng & { id: number; name: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Gold pins for a title's or a place's locations; each opens its location page. */
export default function PlacesMap({ pins }: { pins: MapPin[] }) {
  const first = pins[0] ?? { lat: 52.52, lng: 13.405 };
  const [ref, map] = useLeafletMap({ center: [first.lat, first.lng], zoom: 14, scrollWheelZoom: false });

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const layer = L.layerGroup(pins.map((p) =>
      L.circleMarker([p.lat, p.lng], { radius: 9, color: "#16213A", weight: 2, fillColor: "#E3B04B", fillOpacity: 1 })
        .bindPopup(`<a href="/location/${p.id}" style="font-weight:600">${esc(p.name)}</a>`))).addTo(map);
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
    else map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 15 });
    return () => {
      layer.remove();
    };
  }, [map, pins]);

  return <div ref={ref} className="h-full w-full" />;
}
