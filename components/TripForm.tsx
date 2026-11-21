"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import type { TravelMode } from "@/lib/route";
import {
  FIRST_NAME_MAX, LENGTH_LABEL, MEETING_POINT_MAX, MODE_LABEL, RADIUS_KM, TRIP_LENGTHS, TRIP_MODES, tzLabel, type TripLength,
} from "@/lib/trip";
import { browserTimeZone, saveTripKey } from "@/lib/trip-keys";
import { RequestBox } from "./RequestBox";

type Props = {
  works: { id: string; title: string }[];
  from: { param: string; label: string; tz: string | null };
  placesByMode: Record<TravelMode, number>; // live places of these works within each mode's radius
  nearestCity: string | null;
};

const choice = (on: boolean) =>
  `rounded px-4 py-2 text-sm font-medium ${on ? "bg-accent text-white" : "border border-ink/30 bg-surface"}`;

export function TripForm({ works, from, placesByMode, nearestCity }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<TravelMode>(() => TRIP_MODES.find((m) => placesByMode[m] > 0) ?? "walk");
  const [length, setLength] = useState<TripLength>("half");
  const [when, setWhen] = useState("");
  const [name, setName] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  // A picked city has its own zone; a shared location uses this browser's. Unknown during server render.
  const browserTz = useSyncExternalStore(() => () => {}, browserTimeZone, () => null);
  const tz = from.tz ?? browserTz;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearest, setNearest] = useState<string | null | undefined>(undefined); // set when the server finds none

  const none = placesByMode[mode] === 0 || nearest !== undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          works: works.map((w) => w.id), from: from.param, mode, length,
          startsLocal: when, timeZone: tz, firstName: name, meetingPoint,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422 && json.error === "none_in_range") {
        setNearest(json.nearestCity ?? null);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the trip. Try again.");
      saveTripKey(json.id, json.deleteKey);
      track("trip_created", { mode, length, stops: json.stops, works: works.length, plan: json.source });
      router.push(`/trip/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the trip. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">How will you get around?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRIP_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={choice(mode === m)}
              onClick={() => { setMode(m); setNearest(undefined); }}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink/70">
          Places within about {RADIUS_KM[mode]} km of {from.label}: {placesByMode[mode]}
        </p>
      </fieldset>

      {none ? (
        <div className="rounded-md bg-surface p-4 ring-1 ring-ink/10">
          <p className="font-semibold">
            No films near you yet.
            {(nearest ?? nearestCity) && ` The nearest are in ${nearest ?? nearestCity}.`}
          </p>
          {TRIP_MODES.some((m) => placesByMode[m] > 0) && (
            <p className="mt-1 text-sm text-ink/80">Try another way of getting around above.</p>
          )}
          <RequestBox near={from.label === "your location" ? undefined : from.label} />
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="text-sm font-semibold">How long?</legend>
            <div className="mt-2 flex gap-2">
              {TRIP_LENGTHS.map((l) => (
                <button key={l} type="button" aria-pressed={length === l} className={choice(length === l)} onClick={() => setLength(l)}>
                  {LENGTH_LABEL[l]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="trip-when" className="text-sm font-semibold">Date and start time</label>
            <input id="trip-when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink/30 bg-surface px-4 py-2" />
            {tz && <p className="mt-1 text-xs text-ink/70">In {tzLabel(tz)} time.</p>}
          </div>

          <div>
            <label htmlFor="trip-meet" className="text-sm font-semibold">Meeting point <span className="font-normal">(optional)</span></label>
            <input id="trip-meet" maxLength={MEETING_POINT_MAX} value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)}
              placeholder="The first stop" className="mt-1 block w-full rounded-md border border-ink/30 bg-surface px-4 py-2" />
            <p className="mt-1 text-xs text-ink/70">Pick a public place. Leave empty to meet at the first stop.</p>
          </div>

          <div>
            <label htmlFor="trip-name" className="text-sm font-semibold">Your first name</label>
            <input id="trip-name" required maxLength={FIRST_NAME_MAX} autoComplete="given-name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink/30 bg-surface px-4 py-2" />
            <p className="mt-1 text-xs text-ink/70">Shown on the trip page. No surname or contact details needed.</p>
          </div>

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={sending}
            className="w-full rounded bg-ink px-5 py-3 font-semibold text-paper disabled:opacity-60">
            {sending ? "Planning your trip…" : "Create the trip"}
          </button>
        </>
      )}
    </form>
  );
}
