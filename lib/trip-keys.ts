"use client";

// Organiser delete keys, kept only in the organiser's browser (localStorage), one per trip.
const prefix = "trip-key:";
const listeners = new Set<() => void>();

export function saveTripKey(tripId: string, key: string): void {
  try {
    localStorage.setItem(prefix + tripId, key);
  } catch {
    // private mode: the secret link still works
  }
  listeners.forEach((l) => l());
}

export function forgetTripKey(tripId: string): void {
  try {
    localStorage.removeItem(prefix + tripId);
  } catch {}
  listeners.forEach((l) => l());
}

export function readTripKey(tripId: string): string | null {
  try {
    return localStorage.getItem(prefix + tripId);
  } catch {
    return null;
  }
}

export function subscribeTripKeys(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const JOINED = "trips-joined";

/** Remembers a trip this browser joined. Only the trip ID is kept, and only on this device. */
export function rememberJoinedTrip(tripId: string): void {
  try {
    const ids = new Set(JSON.parse(localStorage.getItem(JOINED) ?? "[]") as string[]);
    ids.add(tripId);
    localStorage.setItem(JOINED, JSON.stringify([...ids].slice(-MY_TRIPS_MAX)));
  } catch {}
  listeners.forEach((l) => l());
}

export const MY_TRIPS_MAX = 50;
export type MyTripRef = { id: string; role: "organiser" | "joined" };

/** Trips created (an organiser key is saved) or joined in this browser. */
export function myTripRefs(): MyTripRef[] {
  try {
    const created: MyTripRef[] = Object.keys(localStorage).filter((k) => k.startsWith(prefix))
      .map((k) => ({ id: k.slice(prefix.length), role: "organiser" }));
    const joined = (JSON.parse(localStorage.getItem(JOINED) ?? "[]") as unknown[])
      .filter((id): id is string => typeof id === "string" && !created.some((c) => c.id === id))
      .map((id): MyTripRef => ({ id, role: "joined" }));
    return [...created, ...joined].slice(0, MY_TRIPS_MAX);
  } catch {
    return [];
  }
}

/** The browser's own time zone, e.g. "Europe/London". */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
