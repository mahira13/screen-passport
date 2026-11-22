"use client";

import { useState } from "react";
import { canCheckIn, formatDistance, haversineKm, isWithinCheckIn } from "@/lib/distance";
import type { NearbyPlace } from "@/lib/nearby";
import { checkIn } from "@/lib/passport-store";
import { usePassport } from "@/lib/use-passport";

type State =
  | { kind: "idle" | "locating" }
  | { kind: "far"; km: number }
  | { kind: "error"; text: string };

const btn = "label inline-flex min-h-11 items-center justify-center gap-2 px-3.5 transition-colors";

/**
 * "I'm here": the phone must be within 200 m of the place, or inside a large site's bounding box.
 * Only offered for source, verified or checked landmark pins; approximate pins can be kilometres off.
 * The position is compared in the browser and never sent anywhere.
 */
export function CheckInButton({ place }: { place: NearbyPlace }) {
  const { visited } = usePassport();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (!canCheckIn({ lat: place.lat, lng: place.lng, coord_quality: place.coordQuality })) return null;

  if (visited.includes(place.id)) {
    return (
      <span className={`${btn} border border-accent bg-accent/15 text-accent`} role="status">
        <span aria-hidden>★</span> Checked in
      </span>
    );
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setState({ kind: "error", text: "Your browser can't share a location, so check-in isn't possible here." });
      return;
    }
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const km = haversineKm(here, place);
        if (isWithinCheckIn(here, place)) {
          checkIn(place.id, place.workId, null);
          setState({ kind: "idle" });
        } else setState({ kind: "far", km });
      },
      () => setState({ kind: "error", text: "Couldn't get your location. Allow location access and try again." }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="contents">
      <button type="button" onClick={locate} disabled={state.kind === "locating"}
        className={`${btn} border border-accent text-accent hover:bg-accent hover:text-paper disabled:opacity-60`}>
        <span aria-hidden>◎</span> {state.kind === "locating" ? "Checking where you are…" : "I'm here"}
      </button>
      {state.kind === "far" && (
        <p role="status" className="w-full text-xs text-ink/75">
          You&apos;re {formatDistance(state.km)} away. Check in when you&apos;re within 200 m.
        </p>
      )}
      {state.kind === "error" && <p role="alert" className="w-full text-xs text-ink/75">{state.text}</p>}
    </div>
  );
}
