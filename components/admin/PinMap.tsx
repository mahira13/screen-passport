"use client";

import { REGION } from "@/lib/region";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useLeafletMap } from "@/lib/use-leaflet-map";

const REGION_CENTRE: [number, number] = [REGION.centre.lat, REGION.centre.lng];

// A plain dot avoids Leaflet's default marker images, which bundlers break.
const pin = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#E3B04B;border:3px solid #16213A"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type Props = { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void };

export default function PinMap({ lat, lng, onPick }: Props) {
  const has = lat !== null && lng !== null;
  const [ref, map] = useLeafletMap({ center: has ? [lat, lng] : REGION_CENTRE, zoom: has ? 16 : 6 });
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Click to place.
  useEffect(() => {
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => pick.current(e.latlng.lat, e.latlng.lng);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  // Draggable pin, kept in view.
  useEffect(() => {
    if (!map || lat === null || lng === null) return;
    const marker = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      pick.current(p.lat, p.lng);
    });
    if (!map.getBounds().contains([lat, lng])) map.setView([lat, lng], Math.max(map.getZoom(), 15));
    return () => {
      marker.remove();
    };
  }, [map, lat, lng]);

  return <div ref={ref} className="h-48 w-full rounded" />;
}
