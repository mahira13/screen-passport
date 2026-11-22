"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { formatDistance } from "@/lib/distance";
import { LAYLA_URL, laylaPrompt } from "@/lib/layla";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";

const linkBtn = "label inline-flex min-h-11 items-center justify-center px-3.5 transition-colors";

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
    <article className="border-l-2 border-accent/60 bg-paper/70 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-serif text-2xl leading-tight">{p.name}</h4>
        <span className="label shrink-0 text-ink/70">{formatDistance(p.distanceKm)}</span>
      </div>
      <p className="label mt-1 text-ink/60">
        {p.title}
        {p.city && ` · ${p.city}`}
      </p>
      {p.sceneNote && <p className="mt-2 font-serif text-lg italic leading-snug text-accent">{p.sceneNote}</p>}
      {(p.visitNote || approximate) && (
        <p className="mt-2 text-xs text-ink/70">
          {p.visitNote}
          {p.visitNote && approximate && " · "}
          {approximate && "Pin is approximate"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer"
          onClick={() => track("directions_clicked", { location: p.id })}
          className={`${linkBtn} bg-accent text-paper hover:bg-ink`}>
          Directions
        </a>
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${linkBtn} border border-ink/30 hover:border-accent hover:text-accent`}
            title={p.sourceName ?? undefined}>
            Source{p.sourceName && <span className="ml-1 max-w-[10rem] truncate normal-case tracking-normal text-ink/60">· {p.sourceName}</span>}
          </a>
        )}
        <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={`${linkBtn} border border-ink/30 hover:border-accent hover:text-accent`}>
          Plan the rest with Layla
        </a>
      </div>
      {copied !== null && (
        <p role="status" className="mt-2 text-xs text-ink/80">
          Copied. Paste it into Layla: <span className="italic">“{copied}”</span>
        </p>
      )}
    </article>
  );
}
