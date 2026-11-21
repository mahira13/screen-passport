"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { formatDistance } from "@/lib/distance";
import { LAYLA_URL, laylaPrompt } from "@/lib/layla";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";

const linkBtn = "label inline-flex items-center justify-center px-3.5 py-2.5 transition-colors";

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

  // Light card: sits inside a title card on the cream index.
  return (
    <article className="bg-bone p-4 text-night shadow-[0_1px_0_rgba(16,16,18,.08)]">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-serif text-2xl leading-tight">{p.name}</h4>
        <span className="label shrink-0 text-night/60">{formatDistance(p.distanceKm)}</span>
      </div>
      <p className="label mt-1 text-night/50">
        {p.title}
        {p.city && ` · ${p.city}`}
      </p>
      {p.sceneNote && <p className="mt-2 font-serif text-lg italic leading-snug text-burgundy">{p.sceneNote}</p>}
      {(p.visitNote || approximate) && (
        <p className="mt-2 text-xs text-night/65">
          {p.visitNote}
          {p.visitNote && approximate && " · "}
          {approximate && "Pin is approximate"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer"
          onClick={() => track("directions_clicked", { location: p.id })}
          className={`${linkBtn} bg-night text-mustard hover:bg-burgundy hover:text-cream`}>
          Directions
        </a>
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${linkBtn} border border-night/30 hover:border-night`}
            title={p.sourceName ?? undefined}>
            Source{p.sourceName && <span className="ml-1 max-w-[10rem] truncate normal-case tracking-normal text-night/55">· {p.sourceName}</span>}
          </a>
        )}
        <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={`${linkBtn} bg-burgundy text-cream hover:bg-night`}>
          Plan the rest with Layla
        </a>
      </div>
      {copied !== null && (
        <p role="status" className="mt-2 text-xs text-night/75">
          Copied. Paste it into Layla: <span className="italic">“{copied}”</span>
        </p>
      )}
    </article>
  );
}
