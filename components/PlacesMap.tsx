"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "@/lib/leaflet-global"; // must load before the plugin
import "leaflet.markercluster";
import { useEffect } from "react";
import type { LatLng } from "@/lib/types";
import { clusterHtml, MARKER_SIZE, markerHtml, markerThumb } from "@/lib/map-markers";
import { useLeafletMap } from "@/lib/use-leaflet-map";

export type MapPin = LatLng & { id: number; name: string; thumb?: string | null; label?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Photo pins (initials without a photo) for a title's or a place's locations; each opens its location page. */
export default function PlacesMap({ pins }: { pins: MapPin[] }) {
  const first = pins[0] ?? { lat: 52.52, lng: 13.405 };
  const [ref, map] = useLeafletMap({ center: [first.lat, first.lng], zoom: 14, scrollWheelZoom: false });

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const thumbOf = new WeakMap<L.Marker, string | null>();
    const layer = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 40, disableClusteringAtZoom: 17,
      iconCreateFunction: (c) => L.divIcon({ className: "", iconSize: [MARKER_SIZE + 4, MARKER_SIZE + 4],
        html: clusterHtml(c.getAllChildMarkers().map((m) => thumbOf.get(m) ?? null).find(Boolean) ?? null, c.getChildCount()) }),
    });
    layer.addLayers(pins.map((p) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "", html: markerHtml({ thumb: markerThumb(p.thumb), label: p.label ?? p.name, aria: p.name }),
          iconSize: [MARKER_SIZE, MARKER_SIZE], iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2], popupAnchor: [0, -MARKER_SIZE / 2],
        }),
        title: p.name,
      }).bindPopup(`<a href="/location/${p.id}" style="font-weight:600">${esc(p.name)}</a>`);
      thumbOf.set(marker, markerThumb(p.thumb));
      return marker;
    }));
    map.addLayer(layer);
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
    else map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 15 });
    return () => {
      layer.remove();
    };
  }, [map, pins]);

  return <div ref={ref} className="h-full w-full" />;
}
