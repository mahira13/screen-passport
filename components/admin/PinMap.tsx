"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const BERLIN: [number, number] = [52.52, 13.405];

// A plain dot avoids Leaflet's default marker images, which bundlers break.
const pin = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#E3B04B;border:3px solid #16213A"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type Props = { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void };

function ClickToPlace({ onPick }: Pick<Props, "onPick">) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function KeepInView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([lat, lng])) map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [map, lat, lng]);
  return null;
}

export default function PinMap({ lat, lng, onPick }: Props) {
  const has = lat !== null && lng !== null;
  return (
    <MapContainer center={has ? [lat, lng] : BERLIN} zoom={has ? 16 : 10} className="h-48 w-full rounded">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ClickToPlace onPick={onPick} />
      {has && (
        <>
          <Marker position={[lat, lng]} icon={pin} draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onPick(p.lat, p.lng); } }} />
          <KeepInView lat={lat} lng={lng} />
        </>
      )}
    </MapContainer>
  );
}
