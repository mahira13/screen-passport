"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { INSTAGRAM_HINT } from "@/lib/share-link";

/** Under every image share: "Copy link" (the fallback, and the story link sticker) and the Instagram hint. */
export function ShareExtras({ url }: { url: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <button type="button" onClick={() => setNote(copyText(url) ? "Link copied." : url)}
        className="label w-full max-w-xs border border-ink/30 px-5 py-3.5 transition-colors hover:border-accent hover:text-accent">
        Copy link
      </button>
      {note && <p role="status" className="max-w-xs break-all text-sm">{note}</p>}
      <p className="max-w-xs text-xs text-ink/65"><span className="font-semibold">Instagram</span> · {INSTAGRAM_HINT}</p>
    </div>
  );
}
