"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLive, verifyCoordinates, type ActionResult } from "@/app/admin/locations/actions";
import { parseLatLng } from "@/lib/distance";
import { isUntrustedSource } from "@/lib/sources";
import type { FilmLocation } from "@/lib/types";

const PinMap = dynamic(() => import("./PinMap"), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded bg-surface" />,
});

export type ReviewLocation = Pick<
  FilmLocation,
  "id" | "name" | "scene_note" | "address" | "city" | "lat" | "lng" | "coord_quality" | "visit_note" | "source_name" | "source_url" | "geocode_query" | "verification_status"
> & {
  works: { title: string } | null;
  review: { decision: string; reasons: string[]; evidence_quote: string | null; created_at: string } | null;
};

const QUALITY_NOTE: Record<string, string> = {
  source: "from the source",
  verified: "verified",
  approx: "approximate, check it",
  geocoded: "geocoded, check it",
  geocoded_poi: "geocoded on a named landmark",
};

// Mount the map only once the card scrolls into view: one map per card is heavy.
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

export function LocationReviewCard({ location: l }: { location: ReviewLocation }) {
  const [lat, setLat] = useState(l.lat?.toString() ?? "");
  const [lng, setLng] = useState(l.lng?.toString() ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [ref, seen] = useSeen<HTMLDivElement>();

  const point = parseLatLng(lat, lng);
  const untrusted = isUntrustedSource(l.source_url);
  const run = (action: () => Promise<ActionResult>) => start(async () => setResult(await action()));
  const pick = (a: number, b: number) => {
    setLat(a.toFixed(6));
    setLng(b.toFixed(6));
  };

  return (
    <article className="rounded-lg border border-ink/20 p-4">
      <p className="text-xs text-ink/60">
        #{l.id} · {l.works?.title ?? "Unknown title"} · {l.verification_status?.replace("_", " ") ?? "draft"}
      </p>
      <h2 className="text-lg font-medium">{l.name}</h2>
      {l.scene_note && <p className="text-sm">{l.scene_note}</p>}
      <p className="mt-1 text-sm text-ink/60">
        {[l.address, l.city].filter(Boolean).join(", ")}
        {l.visit_note && ` · ${l.visit_note}`}
      </p>
      <p className="mt-2 text-sm">
        Source:{" "}
        <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="underline">
          {l.source_name ?? l.source_url}
        </a>
        {untrusted && <span className="ml-2 rounded bg-red-500/15 px-1.5 text-red-300">not a trusted source</span>}
      </p>

      {l.review && (
        <div className="mt-2 rounded bg-surface p-2 text-sm text-ink">
          <p className="text-xs text-ink/60">AI review {new Date(l.review.created_at).toLocaleString("en-GB")}: {l.review.decision.replace("_", " ")}</p>
          {l.review.reasons.length > 0 && <ul className="mt-1 list-disc pl-5">{l.review.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          {l.review.evidence_quote && <p className="mt-1 italic">“{l.review.evidence_quote}”</p>}
        </div>
      )}

      <div ref={ref} className="mt-3">
        {seen ? (
          <PinMap lat={point?.lat ?? null} lng={point?.lng ?? null} onPick={pick} />
        ) : (
          <div className="h-48 w-full rounded bg-surface" />
        )}
      </div>
      <p className="mt-1 text-xs text-ink/60">
        {l.coord_quality ? `Coordinates ${QUALITY_NOTE[l.coord_quality]}.` : `No coordinates yet. Searched for: ${l.geocode_query ?? "nothing"}.`}{" "}
        Click the map or drag the pin to move it.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Lat
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal"
            className="mt-0.5 block w-32 rounded border border-ink/20 px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">
          Lng
          <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal"
            className="mt-0.5 block w-32 rounded border border-ink/20 px-2 py-1 text-sm" />
        </label>
        <button disabled={pending || !point} onClick={() => run(() => verifyCoordinates(l.id, lat, lng))}
          className="rounded border border-accent px-3 py-1.5 text-sm disabled:opacity-40">
          Verify coordinates
        </button>
        <button disabled={pending || untrusted} onClick={() => run(() => setLive(l.id))}
          className="rounded bg-accent px-3 py-1.5 text-sm text-paper disabled:opacity-40">
          Set live
        </button>
      </div>
      {result && <p className={`mt-2 text-sm ${result.ok ? "text-emerald-300" : "text-red-300"}`}>{result.message}</p>}
    </article>
  );
}
