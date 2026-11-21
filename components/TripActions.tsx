"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { LAYLA_URL } from "@/lib/layla";
import type { LatLng } from "@/lib/types";

export const TripMapLazy = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-charcoal" />,
});

const btn = "label inline-flex items-center justify-center px-5 py-3.5 transition-colors";

type Props = {
  tripId: string;
  routeUrl: string | null;
  transit: boolean;
  laylaPrompt: string;
  shareTitle: string;
  shareText: string; // "Join me on <title> on <date>: <link>"
  shareUrl: string;
};

export function TripActions({ tripId, routeUrl, transit, laylaPrompt, shareTitle, shareText, shareUrl }: Props) {
  const [note, setNote] = useState<string | null>(null);

  const onLayla = () => {
    setNote(copyText(laylaPrompt) ? `Copied. Paste it into Layla: “${laylaPrompt}”` : null);
    track("layla_clicked", { from: "trip", trip: tripId });
  };

  const onShare = async () => {
    track("trip_shared", { trip: tripId });
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText.replace(`: ${shareUrl}`, ""), url: shareUrl });
      } catch {
        // cancelled
      }
      return;
    }
    setNote(copyText(shareText) ? "Link copied. Paste it into WhatsApp or any chat." : shareText);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onShare} className={`${btn} bg-accent text-night hover:bg-ink`}>Share the trip</button>
        {routeUrl && (
          <span className="inline-flex flex-col">
            <a href={routeUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-ink/30 hover:border-accent hover:text-accent`}
              onClick={() => track("directions_clicked", { from: "trip", trip: tripId })}>
              Open all in Google Maps
            </a>
            {transit && <span className="mt-1 px-2 text-xs text-ink/70">Pick public transport in Google Maps.</span>}
          </span>
        )}
        <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={`${btn} bg-burgundy text-cream hover:bg-ink hover:text-night`}>
          Plan travel and stays with Layla
        </a>
      </div>
      {note && <p role="status" className="mt-2 text-xs text-ink/80">{note}</p>}
    </div>
  );
}

export function TripMapBox({ stops, tall = false }: { stops: (LatLng & { name: string })[]; tall?: boolean }) {
  const size = tall ? "h-[calc(100vh-7rem)] min-h-[420px]" : "-mx-4 mt-6 h-[42vh] max-h-[420px] min-h-[240px] sm:mx-0";
  return (
    <div className={`${size} overflow-hidden border-t-2 border-accent`}>
      <TripMapLazy stops={stops} />
    </div>
  );
}
