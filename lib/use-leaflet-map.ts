"use client";

import L from "leaflet";
import { useCallback, useRef, useState } from "react";

export const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * A Leaflet map tied to its element's lifetime: created when the element is attached and
 * removed when it is detached. Next.js hides pages on navigation and shows them again on
 * Back, which detaches and re-attaches refs, so the map is rebuilt cleanly instead of
 * reusing a removed one. Layers belong in effects that depend on the returned map.
 */
export function useLeafletMap(options: L.MapOptions) {
  const [map, setMap] = useState<L.Map | null>(null);
  const initial = useRef(options); // options are read once, like Leaflet itself

  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const m = L.map(el, initial.current);
    L.tileLayer(OSM_URL, { attribution: OSM_ATTRIBUTION }).addTo(m);
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
  }, []);

  return [ref, map] as const;
}
