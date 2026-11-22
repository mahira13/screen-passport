"use client";

import { useState, useTransition } from "react";
import { moveCollection, pinCollection, unpinCollection, type ActionResult } from "@/app/admin/locations/actions";

export type PinRow = { id: string; name: string; rank: number | null; places: number; checkIn: number };

const btn = "min-h-11 rounded border px-3 text-sm disabled:opacity-40";

/** Pin, unpin and order the curated collections Discover shows first. */
export function FeaturedPins({ rows, preview }: { rows: PinRow[]; preview: string[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (a: () => Promise<ActionResult>) => start(async () => setResult(await a()));
  const pinned = rows.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!);
  const others = rows.filter((r) => r.rank === null);
  return (
    <section className="mt-6 rounded-lg border border-ink/20 p-4">
      <h2 className="text-lg font-semibold">Featured collections</h2>
      <p className="mt-1 text-sm text-ink/60">
        Pinned collections show first on Discover, in this order. The remaining slots are filled per visitor
        (places near them ×3, check-in grade ×2, photos).
      </p>
      <p className="mt-2 text-sm">Discover now, without a location: <strong>{preview.join(" · ") || "nothing"}</strong></p>

      <ol className="mt-4 space-y-2">
        {pinned.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-sm text-ink/60">{r.rank}</span>
            <span className="flex-1 font-medium">{r.name} <span className="text-xs text-ink/60">{r.places} places · {r.checkIn} check-in</span></span>
            <button className={btn} disabled={pending || i === 0} onClick={() => run(() => moveCollection(r.id, "up"))} aria-label={`Move ${r.name} up`}>↑</button>
            <button className={btn} disabled={pending || i === pinned.length - 1} onClick={() => run(() => moveCollection(r.id, "down"))} aria-label={`Move ${r.name} down`}>↓</button>
            <button className={btn} disabled={pending} onClick={() => run(() => unpinCollection(r.id))}>Unpin</button>
          </li>
        ))}
      </ol>
      {others.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-ink/20 pt-3">
          {others.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{r.name} <span className="text-xs text-ink/60">{r.places} places · {r.checkIn} check-in</span></span>
              <button className={btn} disabled={pending} onClick={() => run(() => pinCollection(r.id))}>Pin</button>
            </li>
          ))}
        </ul>
      )}
      {result && <p role="status" className={`mt-2 text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>{result.message}</p>}
    </section>
  );
}
