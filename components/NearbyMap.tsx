"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { formatDistance } from "@/lib/distance";
import { initialMapPlaces, type NearbyPlace } from "@/lib/nearby";
import type { LatLng } from "@/lib/types";

type Props = { origin: LatLng; places: NearbyPlace[]; onReady?: () => void };

function FitToPlaces({ origin, places }: Omit<Props, "onReady">) {
  const map = useMap();
  useEffect(() => {
    const focus = initialMapPlaces(places);
    if (focus.length === 0) {
      map.setView([origin.lat, origin.lng], 11);
      return;
    }
    const bounds = L.latLngBounds([[origin.lat, origin.lng], ...focus.map((p) => [p.lat, p.lng] as [number, number])]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [map, origin, places]);
  return null;
}

export default function NearbyMap({ origin, places, onReady }: Props) {
  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={11}
      className="h-full w-full"
      whenReady={onReady}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {places.map((p) => (
        <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7}
          pathOptions={{ color: "#16213A", weight: 2, fillColor: "#16213A", fillOpacity: 0.85 }}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.title} · {formatDistance(p.distanceKm)}
          </Popup>
        </CircleMarker>
      ))}
      <CircleMarker center={[origin.lat, origin.lng]} radius={8}
        pathOptions={{ color: "#16213A", weight: 3, fillColor: "#E3B04B", fillOpacity: 1 }} />
      <FitToPlaces origin={origin} places={places} />
    </MapContainer>
  );
}
