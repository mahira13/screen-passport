"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { CARD_HEIGHT, CARD_WIDTH, shareText, type CardData } from "@/lib/share-card";
import { canShareFiles, renderPng, shareOrDownload } from "@/lib/share-image";
import { usePassport } from "@/lib/use-passport";
import { ShareCardArt } from "./ShareCardArt";

const PREVIEW_SCALE = 0.3;
const FILE_NAME = "screen-passport.png";

/** Shown only to the passport's owner: preview + share/download. */
export function ShareCard({ passportId, data }: { passportId: string; data: CardData }) {
  const { id } = usePassport();
  if (id !== passportId) return null;
  return <ShareCardInner data={data} />;
}

function ShareCardInner({ data }: { data: CardData }) {
  const node = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canShare] = useState(canShareFiles);
  const link = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const host = new URL(link).host.replace(/^www\./, "");

  // Draw ahead of time: iOS only opens the share sheet straight after a tap,
  // so the image has to be ready before the tap.
  useEffect(() => {
    let cancelled = false;
    if (node.current) {
      renderPng(node.current, CARD_WIDTH, CARD_HEIGHT)
        .then((b) => !cancelled && setBlob(b))
        .catch(() => !cancelled && setMessage("Couldn't draw your card. Try reloading the page."));
    }
    return () => {
      cancelled = true;
    };
  }, [data, host]);

  const onShare = async () => {
    track("share_clicked", { method: canShare ? "share" : "download", titles: data.stamps.length + data.moreStamps });
    setMessage(null);
    let b = blob;
    if (!b && node.current) {
      setBusy(true);
      try {
        b = await renderPng(node.current, CARD_WIDTH, CARD_HEIGHT);
        setBlob(b);
      } catch {
        setMessage("Couldn't draw your card. Try reloading the page.");
      } finally {
        setBusy(false);
      }
    }
    if (!b) return;
    const file = new File([b], FILE_NAME, { type: "image/png" });
    const outcome = await shareOrDownload(file, canShare, {
      title: "My Screen Passport",
      text: shareText(data.placeCount, data.cityName, link),
    });
    if (outcome === "tap_again") setMessage("Your card is ready. Tap Share again.");
  };

  return (
    <section className="grid items-center gap-10 py-14 sm:py-20 md:grid-cols-[auto_1fr] md:gap-16">
      <div className="order-2 flex flex-col items-center gap-4 md:order-1">
        <div
          className="rotate-[-2deg] overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-accent/40"
          style={{ width: CARD_WIDTH * PREVIEW_SCALE, height: CARD_HEIGHT * PREVIEW_SCALE }}
          aria-label="Preview of your share card"
          role="img"
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
            <div ref={node}>
              <ShareCardArt data={data} host={host} />
            </div>
          </div>
        </div>
      </div>
      <div className="order-1 md:order-2">
        <p className="label text-accent">Share</p>
        <h2 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl">
          Your passport, <span className="italic">as a story.</span>
        </h2>
        <p className="mt-4 max-w-md text-ink/70">A 1080×1920 card with your stamps, places and link, drawn on your phone.</p>
        <button
          type="button"
          onClick={onShare}
          disabled={busy}
          className="label mt-6 w-full max-w-xs bg-accent px-5 py-4 text-night transition-colors hover:bg-ink disabled:opacity-60"
        >
          {busy ? "Drawing your card…" : canShare ? "Share to your story" : "Download image"}
        </button>
        {message && <p role="status" className="mt-3 text-sm">{message}</p>}
        {!canShare && <p className="mt-2 text-xs text-ink/60">Then post the image from your photos.</p>}
      </div>
    </section>
  );
}
