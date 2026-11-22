"use client";

import { useState, useTransition } from "react";
import { findAnotherImage, setImageStatus, type ActionResult } from "@/app/admin/locations/actions";

export type ImageRow = {
  id: number; name: string; city: string | null; image_thumb_url: string | null; image_author: string | null;
  image_license: string | null; image_source_page: string | null; image_status: string | null;
  image_check_reason: string | null;
};

/** One Commons photo: Approve, Reject or Find another. */
export function ImageReviewCard({ row }: { row: ImageRow }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (a: () => Promise<ActionResult>) => start(async () => setResult(await a()));
  return (
    <article className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs text-neutral-500">#{row.id} · {row.image_status ?? "needs review"}</p>
      <h3 className="font-medium">{row.name}{row.city && `, ${row.city}`}</h3>
      {row.image_thumb_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.image_thumb_url} alt={`Photo of ${row.name}`} className="mt-2 aspect-video w-full rounded object-cover" loading="lazy" />
      ) : <p className="mt-2 text-sm text-neutral-500">No photo.</p>}
      {row.image_source_page && (
        <p className="mt-1 text-xs">
          <a href={row.image_source_page} target="_blank" rel="noopener noreferrer" className="underline">
            {row.image_author}, {row.image_license}
          </a>
        </p>
      )}
      {row.image_check_reason && <p className="mt-1 text-xs text-neutral-600">Claude: {row.image_check_reason}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={pending || !row.image_thumb_url || row.image_status === "approved"} onClick={() => run(() => setImageStatus(row.id, "approved"))}
          className="min-h-11 rounded bg-neutral-900 px-3 text-sm text-white disabled:opacity-40">Approve</button>
        <button disabled={pending || !row.image_thumb_url || row.image_status === "rejected"} onClick={() => run(() => setImageStatus(row.id, "rejected"))}
          className="min-h-11 rounded border border-neutral-900 px-3 text-sm disabled:opacity-40">Reject</button>
        <button disabled={pending} onClick={() => run(() => findAnotherImage(row.id))}
          className="min-h-11 rounded border border-neutral-400 px-3 text-sm disabled:opacity-40">{pending ? "Searching…" : "Find another"}</button>
      </div>
      {result && <p role="status" className={`mt-1 text-xs ${result.ok ? "text-green-700" : "text-red-500"}`}>{result.message}</p>}
    </article>
  );
}
