// Start cities for tests (in the app they are built from published places).
import type { City } from "@/lib/cities";

const city = (id: string, name: string, lat: number, lng: number): City => ({ id, name, lat, lng, tz: "Europe/Berlin", places: 5 });

export const BERLIN = city("berlin", "Berlin", 52.52, 13.405);
export const GOERLITZ = city("goerlitz", "Görlitz", 51.1528, 14.9872);
export const HAMBURG = city("hamburg", "Hamburg", 53.5511, 9.9937);
export const CITIES = [BERLIN, GOERLITZ, HAMBURG];
