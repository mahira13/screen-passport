"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import type { TravelMode } from "@/lib/route";
import { FIRST_NAME_MAX, LENGTH_LABEL, MODE_LABEL, RADIUS_KM, TRIP_LENGTHS, TRIP_MODES, type TripLength } from "@/lib/trip";
import { RequestBox } from "./RequestBox";

type Props = {
  works: { id: string; title: string }[];
  from: { param: string; label: string };
  placesByMode: Record<TravelMode, number>; // live places of these works within each mode's radius
  nearestCity: string | null;
};

const choice = (on: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium ${on ? "bg-navy text-cream" : "border border-navy/30 bg-white"}`;

export function TripForm({ works, from, placesByMode, nearestCity }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<TravelMode>(() => TRIP_MODES.find((m) => placesByMode[m] > 0) ?? "walk");
  const [length, setLength] = useState<TripLength>("half");
  const [when, setWhen] = useState("");
  const [name, setName] = useState("");
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
          startsAt: new Date(when).toISOString(), firstName: name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422 && json.error === "none_in_range") {
        setNearest(json.nearestCity ?? null);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the trip. Try again.");
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
        <p className="mt-1 text-xs text-navy/70">
          Places within about {RADIUS_KM[mode]} km of {from.label}: {placesByMode[mode]}
        </p>
      </fieldset>

      {none ? (
        <div className="rounded-xl bg-white p-4 ring-1 ring-navy/10">
          <p className="font-semibold">
            No films near you yet.
            {(nearest ?? nearestCity) && ` The nearest are in ${nearest ?? nearestCity}.`}
          </p>
          {TRIP_MODES.some((m) => placesByMode[m] > 0) && (
            <p className="mt-1 text-sm text-navy/80">Try another way of getting around above.</p>
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
              className="mt-1 block w-full rounded-xl border border-navy/30 bg-white px-4 py-2" />
          </div>

          <div>
            <label htmlFor="trip-name" className="text-sm font-semibold">Your first name</label>
            <input id="trip-name" required maxLength={FIRST_NAME_MAX} autoComplete="given-name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-navy/30 bg-white px-4 py-2" />
            <p className="mt-1 text-xs text-navy/70">Shown on the trip page. No surname or contact details needed.</p>
          </div>

          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={sending}
            className="w-full rounded-full bg-navy px-5 py-3 font-semibold text-cream disabled:opacity-60">
            {sending ? "Planning your trip…" : "Create the trip"}
          </button>
        </>
      )}
    </form>
  );
}
