import type { LatLng } from "./types";

export interface City extends LatLng {
  id: string;
  name: string;
}

// City centres, used as the start point when the user picks a city.
export const CITIES: City[] = [
  { id: "berlin", name: "Berlin", lat: 52.52, lng: 13.405 },
  { id: "potsdam", name: "Potsdam", lat: 52.3906, lng: 13.0645 },
  { id: "hamburg", name: "Hamburg", lat: 53.5511, lng: 9.9937 },
  { id: "munich", name: "München", lat: 48.1374, lng: 11.5755 },
  { id: "cologne", name: "Köln", lat: 50.9375, lng: 6.9603 },
  { id: "frankfurt", name: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { id: "duesseldorf", name: "Düsseldorf", lat: 51.2277, lng: 6.7735 },
  { id: "stuttgart", name: "Stuttgart", lat: 48.7758, lng: 9.1829 },
  { id: "leipzig", name: "Leipzig", lat: 51.3397, lng: 12.3731 },
  { id: "dresden", name: "Dresden", lat: 51.0504, lng: 13.7373 },
  { id: "goerlitz", name: "Görlitz", lat: 51.1528, lng: 14.9872 },
];

export const DEFAULT_CITY = CITIES[0];

export function findCity(id: string | null | undefined): City | undefined {
  return CITIES.find((c) => c.id === id);
}
