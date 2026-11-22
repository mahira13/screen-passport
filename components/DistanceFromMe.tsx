"use client";

import { useState } from "react";
import { formatDistance, haversineKm } from "@/lib/distance";
import type { LatLng } from "@/lib/types";

type State = { kind: "idle" | "locating" } | { kind: "done"; km: number } | { kind: "error"; text: string };

/** "How far is it?": compared in the browser; the position is never sent anywhere. */
export function DistanceFromMe({ to }: { to: LatLng }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  if (state.kind === "done") return <p className="label inline-flex min-h-11 items-center text-ink/80">{formatDistance(state.km)} from you</p>;
  const locate = () => {
    if (!navigator.geolocation) return setState({ kind: "error", text: "Your browser can't share a location." });
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ kind: "done", km: haversineKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, to) }),
      () => setState({ kind: "error", text: "Couldn't get your location." }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={locate} disabled={state.kind === "locating"}
        className="label inline-flex min-h-11 items-center gap-2 border border-ink/30 px-3.5 transition-colors hover:border-accent hover:text-accent disabled:opacity-60">
        <span aria-hidden>◎</span> {state.kind === "locating" ? "Locating…" : "How far is it?"}
      </button>
      {state.kind === "error" && <span role="alert" className="text-xs text-red-400">{state.text}</span>}
    </span>
  );
}
