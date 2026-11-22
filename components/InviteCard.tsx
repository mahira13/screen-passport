"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { INVITE_HEIGHT, INVITE_WIDTH, inviteCaption, type InviteData } from "@/lib/invite-card";
import { canShareFiles, renderPng, shareOrDownload } from "@/lib/share-image";
import { InviteCardArt } from "./InviteCardArt";

const PREVIEW_SCALE = 0.25;
const FILE_NAME = "screen-passport-invite.png";
const noop = () => () => {};
const LINK_COPIED = "Link copied. Add it as a link sticker in your story.";

/** "Now showing" story invite: preview, share to story (or download), copy caption. */
export function InviteCard({ tripId, data }: { tripId: string; data: InviteData }) {
  const node = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Known only in the browser; the server render assumes download.
  const canShare = useSyncExternalStore(noop, canShareFiles, () => false);
  const caption = inviteCaption(data);

  // Draw ahead of time: iOS only opens the share sheet straight after a tap.
  useEffect(() => {
    let cancelled = false;
    if (node.current) {
      renderPng(node.current, INVITE_WIDTH, INVITE_HEIGHT)
        .then((b) => !cancelled && setBlob(b))
        .catch(() => !cancelled && setMessage("Couldn't draw the invite. Try reloading the page."));
    }
    return () => {
      cancelled = true;
    };
  }, [data]);

  const onShare = async () => {
    const copied = copyText(data.link); // the story's link sticker needs it
    track("invite_shared", { trip: tripId, method: canShare ? "share" : "download" });
    setMessage(null);
    let b = blob;
    if (!b && node.current) {
      setBusy(true);
      try {
        b = await renderPng(node.current, INVITE_WIDTH, INVITE_HEIGHT);
        setBlob(b);
      } catch {
        setMessage("Couldn't draw the invite. Try reloading the page.");
      } finally {
        setBusy(false);
      }
    }
    if (!b) return;
    const outcome = await shareOrDownload(new File([b], FILE_NAME, { type: "image/png" }), canShare, {
      title: data.tripTitle,
      text: caption,
    });
    if (outcome === "tap_again") setMessage("Your invite is ready. Tap Share again.");
    else if (outcome !== "cancelled") setMessage(copied ? LINK_COPIED : `Add this link as a sticker in your story: ${data.link}`);
  };

  const onCaption = () => {
    setMessage(copyText(caption) ? `Caption copied${data.hashtags.length ? ` with ${data.hashtags.join(" ")}` : ""}.` : caption);
  };

  return (
    <section className="mt-6 bg-surface p-5 sm:p-6">
      <h2 className="label text-accent">Invite friends</h2>
      <p className="mt-2 font-display text-2xl leading-tight">Now showing, in your story.</p>
      <p className="mt-1 text-sm text-ink/70">A &quot;Now showing&quot; ticket for your story, with the trip link.</p>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
        <div
          className="shrink-0 rotate-[-2deg] overflow-hidden shadow-2xl shadow-black/60"
          style={{ width: INVITE_WIDTH * PREVIEW_SCALE, height: INVITE_HEIGHT * PREVIEW_SCALE }}
          aria-label={`Preview of the invite: Now showing ${data.tripTitle}, ${data.when}, venue ${data.venue}`}
          role="img"
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
            <div ref={node}>
              <InviteCardArt data={data} />
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <button type="button" onClick={onShare} disabled={busy}
            className="label bg-accent px-5 py-3.5 text-paper transition-colors hover:bg-ink disabled:opacity-60">
            {busy ? "Drawing your invite…" : canShare ? "Share to your story" : "Download invite"}
          </button>
          <button type="button" onClick={onCaption} className="label border border-ink/30 px-5 py-3.5 transition-colors hover:border-accent hover:text-accent">
            Copy caption
          </button>
          {message && <p role="status" className="max-w-xs text-sm">{message}</p>}
          {!canShare && <p className="max-w-xs text-xs text-ink/60">Then post the image from your photos.</p>}
        </div>
      </div>
    </section>
  );
}
