"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { canCheckIn, formatDistance } from "@/lib/distance";
import { LAYLA_URL, laylaPrompt } from "@/lib/layla";
import { directionsUrl } from "@/lib/links";
import type { NearbyPlace } from "@/lib/nearby";
import { CheckInButton } from "./CheckInButton";
import { Cover } from "./Cover";
import { InfoTip } from "./InfoTip";
import { VerifiedBadge } from "./VerifiedBadge";

const btn = "label inline-flex min-h-11 items-center justify-center px-4 transition-colors";
const quiet = "label inline-flex min-h-11 items-center px-1 text-ink/60 transition-colors hover:text-accent";

type Props = { place: NearbyPlace; titlePlaces: NearbyPlace[]; showPhoto?: boolean };

export function LocationCard({ place: p, titlePlaces, showPhoto = true }: Props) {
  const [copied, setCopied] = useState(false);
  const approximate = !canCheckIn({ lat: p.lat, lng: p.lng, coord_quality: p.coordQuality });

  // The link opens Layla itself (target=_blank); copying the prompt happens in the same tap.
  const onLayla = () => {
    setCopied(copyText(laylaPrompt(p.title, p, titlePlaces)));
    track("layla_clicked", { work: p.workId, location: p.id });
  };
  const notes = [
    p.visitNote,
    approximate && "Approximate location, so check-in isn't offered.",
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-sm bg-paper/60">
      {showPhoto && (
        <div className="relative">
          <Link href={`/location/${p.id}`} className="group block" tabIndex={-1} aria-hidden>
            <Cover photo={p.photo} label={p.title} className="aspect-[16/9]" />
          </Link>
          <VerifiedBadge by={p.verifiedBy} className="absolute left-2 top-2 z-10" />
        </div>
      )}
      <div className="p-4">
        {!showPhoto && <VerifiedBadge by={p.verifiedBy} className="mb-2" />}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-2xl leading-tight">
            <Link href={`/location/${p.id}`} className="transition-colors hover:text-accent">{p.name}</Link>
          </h4>
          {notes.length > 0 && <InfoTip label={`About ${p.name}`} className="-mr-3 -mt-2 shrink-0">{notes.map((n) => <p key={String(n)}>{n}</p>)}</InfoTip>}
        </div>
        <p className="mt-0.5 text-sm text-ink/65">{formatDistance(p.distanceKm)}{p.city && ` · ${p.city}`}</p>
        {p.sceneNote && <p className="mt-1 line-clamp-1 text-sm text-accent">{p.sceneNote}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CheckInButton place={p} />
          <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" onClick={() => track("directions_clicked", { location: p.id })}
            className={`${btn} bg-accent text-paper hover:bg-ink`}>Directions</a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" title={p.sourceName ?? undefined} className={quiet}>Source ↗</a>}
          <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={quiet}>Plan with Layla ↗</a>
        </div>
        {copied && <p role="status" className="text-xs text-ink/70">Trip prompt copied. Paste it into Layla.</p>}
      </div>
    </article>
  );
}
