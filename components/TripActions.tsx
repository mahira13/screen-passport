"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { LAYLA_URL } from "@/lib/layla";
import type { LatLng } from "@/lib/types";

export const TripMapLazy = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-navy/10" />,
});

const btn = "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold";

type Props = {
  tripId: string;
  routeUrl: string | null;
  laylaPrompt: string;
  shareTitle: string;
  shareText: string; // "Join me on <title> on <date>: <link>"
  shareUrl: string;
};

export function TripActions({ tripId, routeUrl, laylaPrompt, shareTitle, shareText, shareUrl }: Props) {
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
        <button type="button" onClick={onShare} className={`${btn} bg-navy text-cream`}>Share</button>
        {routeUrl && (
          <a href={routeUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-navy/30 bg-white`}
            onClick={() => track("directions_clicked", { from: "trip", trip: tripId })}>
            Open all in Google Maps
          </a>
        )}
        <a href={LAYLA_URL} target="_blank" rel="noopener noreferrer" onClick={onLayla} className={`${btn} bg-gold text-navy`}>
          Plan travel and stays with Layla
        </a>
      </div>
      {note && <p role="status" className="mt-2 text-xs text-navy/80">{note}</p>}
    </div>
  );
}

export function TripMapBox({ stops }: { stops: (LatLng & { name: string })[] }) {
  return (
    <div className="mt-3 h-[40vh] max-h-[380px] min-h-[220px] overflow-hidden rounded-xl ring-1 ring-navy/10">
      <TripMapLazy stops={stops} />
    </div>
  );
}
