"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { formatDistance } from "@/lib/distance";
import { LAYLA_URL, laylaPrompt } from "@/lib/layla";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";

// Works on http too (e.g. a phone on the local network), where navigator.clipboard is missing.
function copyText(text: string): boolean {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  const area = Object.assign(document.createElement("textarea"), { value: text });
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

const linkBtn = "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium";

type Props = { place: NearbyPlace; titlePlaces: NearbyPlace[] };

export function LocationCard({ place: p, titlePlaces }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const approximate = p.coordQuality !== "source" && p.coordQuality !== "verified";
  const prompt = laylaPrompt(p.title, p, titlePlaces);

  // The link opens Layla itself (target=_blank); copying happens in the same tap.
  const onLayla = () => {
    const ok = copyText(prompt);
    setCopied(ok ? prompt : null);
    track("layla_clicked", { work: p.workId, location: p.id });
  };

  return (
    <article className="rounded-lg bg-cream/60 p-3 ring-1 ring-navy/10">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-display font-semibold leading-tight">{p.name}</h4>
        <span className="shrink-0 text-xs text-navy/70">{formatDistance(p.distanceKm)}</span>
      </div>
      <p className="text-xs text-navy/60">
        {p.title}
        {p.city && ` · ${p.city}`}
      </p>
      {p.sceneNote && <p className="mt-1 text-sm">{p.sceneNote}</p>}
      {(p.visitNote || approximate) && (
        <p className="mt-1 text-xs text-navy/70">
          {p.visitNote}
          {p.visitNote && approximate && " · "}
          {approximate && "Pin is approximate"}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer"
          onClick={() => track("directions_clicked", { location: p.id })}
          className={`${linkBtn} bg-navy text-cream`}>
          Directions
        </a>
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${linkBtn} border border-navy/30`}
            title={p.sourceName ?? undefined}>
            Source
          </a>
        )}
        <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={`${linkBtn} bg-gold text-navy`}>
          Plan the rest with Layla
        </a>
      </div>
      {copied !== null && (
        <p role="status" className="mt-2 text-xs text-navy/80">
          Copied. Paste it into Layla: <span className="italic">“{copied}”</span>
        </p>
      )}
    </article>
  );
}
