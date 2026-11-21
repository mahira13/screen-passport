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

/** The browser's own time zone, e.g. "Europe/London". */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
