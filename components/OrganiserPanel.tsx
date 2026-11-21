"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { copyText } from "@/lib/clipboard";
import { forgetTripKey, readTripKey, saveTripKey, subscribeTripKeys } from "@/lib/trip-keys";

/**
 * Only for the organiser: their secret link (#key=… stays in the browser, it is never sent
 * to the server with the page request) and a delete button.
 */
export function OrganiserPanel({ tripId, url }: { tripId: string; url: string }) {
  const router = useRouter();
  const key = useSyncExternalStore(subscribeTripKeys, () => readTripKey(tripId), () => null);
  const [note, setNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Opened from the secret link: remember the key here and tidy the address bar.
  useEffect(() => {
    const m = /(?:^#|&)key=([\w-]{16,64})/.exec(window.location.hash);
    if (!m) return;
    saveTripKey(tripId, m[1]);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [tripId]);

  if (!key) return null;
  const secretLink = `${url}#key=${key}`;

  const remove = async () => {
    if (!window.confirm("Delete this trip for everyone? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/trip/${tripId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }).catch(() => null);
    setDeleting(false);
    if (res?.ok || res?.status === 404) {
      forgetTripKey(tripId);
      router.replace("/");
      return;
    }
    setNote((await res?.json().catch(() => null))?.error ?? "Couldn't delete the trip. Try again.");
  };

  return (
    <section className="mt-6 rounded-md border-2 border-dashed border-ink/30 p-4">
      <h2 className="font-display font-semibold">You organise this trip</h2>
      <p className="mt-1 text-sm">
        Keep your secret organiser link to manage the trip from another phone. Don&apos;t share it: anyone with it can delete the trip.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-ink/30 bg-surface px-4 py-2 text-sm font-semibold"
          onClick={() => setNote(copyText(secretLink) ? "Secret link copied. Save it somewhere private." : secretLink)}>
          Copy secret organiser link
        </button>
        <button type="button" onClick={remove} disabled={deleting}
          className="rounded border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-60">
          Delete trip
        </button>
      </div>
      {note && <p role="status" className="mt-2 break-all text-xs text-ink/80">{note}</p>}
    </section>
  );
}
