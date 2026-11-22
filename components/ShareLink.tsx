"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";

type Props = { path: string; title: string; text: string; what: string; className?: string };

/** Share a public page: the phone's share sheet, or copy the link where there is none. */
export function ShareLink({ path, title, text, what, className = "" }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    track("share_clicked", { what });
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // the visitor closed the sheet
      }
    }
    setNote(copyText(url) ? "Link copied" : url);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={share}
        className={`label inline-flex min-h-11 items-center gap-2 border border-accent px-4 text-accent transition-colors hover:bg-accent hover:text-paper ${className}`}>
        Share <span aria-hidden>↗</span>
      </button>
      {note && <span role="status" className="break-all text-xs text-ink/70">{note}</span>}
    </span>
  );
}
