// The user's passport in the browser: React state via useSyncExternalStore,
// saved to localStorage, and synced to /api/passport in the background.
import { track } from "./analytics";
import { EMPTY_PASSPORT, parseLocalPassport, toggleId, type LocalPassport } from "./passport";

const KEY = "screen-passport";
const SAVE_DELAY_MS = 400;
const RETRY_MS = 5000;

export type SyncStatus = "idle" | "saving" | "error";
export interface PassportState extends LocalPassport {
  sync: SyncStatus;
}

const SERVER_STATE: PassportState = { ...EMPTY_PASSPORT, sync: "idle" };
let state: PassportState | undefined;
const listeners = new Set<() => void>();

function load(): PassportState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  return { ...parseLocalPassport(raw), sync: "idle" };
}

function set(patch: Partial<PassportState>) {
  state = { ...getSnapshot(), ...patch };
  const saved: LocalPassport = {
    id: state.id, editKey: state.editKey, watched: state.watched, visited: state.visited, startCity: state.startCity,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {} // private mode: the passport still works for this visit
  listeners.forEach((l) => l());
}

export function getSnapshot(): PassportState {
  if (state === undefined) state = load();
  return state;
}

export function getServerSnapshot(): PassportState {
  return SERVER_STATE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = load(); // changed in another tab
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function toggleWatched(workId: string, startCity: string | null) {
  const s = getSnapshot();
  const adding = !s.watched.includes(workId);
  set({ watched: toggleId(s.watched, workId), startCity: s.startCity ?? startCity });
  if (adding) track("title_watched", { work: workId, total: s.watched.length + 1 });
  scheduleSave(SAVE_DELAY_MS);
}

/**
 * "I'm here": the browser checked the distance (within 200 m); the server only checks that the
 * place allows check-in. Coordinates never leave the phone.
 */
export function checkIn(locationId: number, workId: string, startCity: string | null) {
  const s = getSnapshot();
  if (s.visited.includes(locationId)) return;
  set({ visited: [...s.visited, locationId], startCity: s.startCity ?? startCity });
  track("checkin_success", { location: locationId, work: workId, total: s.visited.length + 1 });
  scheduleSave(0);
}

// One request at a time; taps during a request are sent right after it.
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let again = false;

function scheduleSave(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(save, delay);
}

async function save() {
  if (inFlight) {
    again = true;
    return;
  }
  inFlight = true;
  again = false;
  const s = getSnapshot();
  try {
    if (!s.id || !s.editKey) {
      if (s.watched.length === 0 && s.visited.length === 0) return;
      const res = await fetch("/api/passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched: s.watched, visited: s.visited, startCity: s.startCity }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id, editKey } = (await res.json()) as { id: string; editKey: string };
      set({ id, editKey, sync: "idle" });
      track("passport_created", { titles: s.watched.length, places: s.visited.length });
      const now = getSnapshot();
      if (now.watched.join() !== s.watched.join() || now.visited.join() !== s.visited.join()) again = true;
    } else {
      set({ sync: "saving" });
      const res = await fetch("/api/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, editKey: s.editKey, watched: s.watched, visited: s.visited }),
      });
      if (res.status === 404 || res.status === 403) {
        set({ id: null, editKey: null }); // passport gone or not ours: start a new one
        again = true;
      } else if (!res.ok) throw new Error(String(res.status));
      else set({ sync: "idle" });
    }
  } catch {
    set({ sync: "error" });
    scheduleSave(RETRY_MS);
  } finally {
    inFlight = false;
    if (again) scheduleSave(0);
  }
}
