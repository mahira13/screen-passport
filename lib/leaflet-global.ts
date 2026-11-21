// leaflet.markercluster extends the global `L`, so Leaflet must be on window
// before the plugin loads. Import this module first.
import L from "leaflet";

if (typeof window !== "undefined") (window as unknown as { L: typeof L }).L = L;

export default L;
