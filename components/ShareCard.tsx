"use client";

import { toBlob } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { CARD_HEIGHT, CARD_WIDTH, shareText, type CardData } from "@/lib/share-card";
import { usePassport } from "@/lib/use-passport";
import { ShareCardArt } from "./ShareCardArt";

const PREVIEW_SCALE = 0.3;
const FILE_NAME = "screen-passport.png";

async function render(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const options = { width: CARD_WIDTH, height: CARD_HEIGHT, pixelRatio: 1, cacheBust: true };
  await toBlob(node, options); // Safari often drops fonts on the first pass; the second is right.
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Could not draw the card");
  return blob;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: FILE_NAME });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob()], FILE_NAME, { type: "image/png" });
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

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
      render(node.current)
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
        b = await render(node.current);
        setBlob(b);
      } catch {
        setMessage("Couldn't draw your card. Try reloading the page.");
      } finally {
        setBusy(false);
      }
    }
    if (!b) return;
    const file = new File([b], FILE_NAME, { type: "image/png" });
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: "My Screen Passport", text: shareText(data.placeCount, data.cityName, link) });
        return;
      } catch (e) {
        const name = (e as Error).name;
        if (name === "AbortError") return; // closed the share sheet
        if (name === "NotAllowedError") {
          setMessage("Your card is ready. Tap Share again.");
          return;
        }
      }
    }
    download(file);
  };

  return (
    <section className="mt-8">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">Share your passport</h2>
      <div className="mt-3 flex flex-col items-center gap-4">
        <div
          className="overflow-hidden rounded-xl shadow-lg ring-1 ring-navy/10"
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
        <button
          type="button"
          onClick={onShare}
          disabled={busy}
          className="w-full max-w-xs rounded-full bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-60"
        >
          {busy ? "Drawing your card…" : canShare ? "Share to your story" : "Download image"}
        </button>
        {message && <p role="status" className="text-sm">{message}</p>}
        {!canShare && <p className="text-xs text-navy/60">Then post the image from your photos.</p>}
      </div>
    </section>
  );
}
