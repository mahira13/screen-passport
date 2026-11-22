"use client";

import { useState, useTransition } from "react";
import { markRecheck, runAiVerification, type ActionResult } from "@/app/admin/locations/actions";

/** "Run AI verification" for drafts and re-checks, and marking any place for re-check by id. */
export function VerificationPanel() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [id, setId] = useState("");
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>) => start(async () => setResult(await action()));
  return (
    <section className="mt-4 rounded-lg border border-neutral-300 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} onClick={() => run(runAiVerification)}
          className="min-h-11 rounded bg-neutral-900 px-4 text-sm text-white disabled:opacity-50">
          {pending ? "Verifying…" : "Run AI verification"}
        </button>
        <span className="text-xs text-neutral-500">Checks up to 3 drafts or re-checks per click.</span>
      </div>
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => markRecheck(Number(id))); }}>
        <label className="text-xs">
          Mark for re-check (location id)
          <input value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric"
            className="mt-0.5 block w-32 rounded border border-neutral-300 px-2 py-1 text-sm" />
        </label>
        <button disabled={pending || !Number(id)} className="min-h-11 rounded border border-neutral-900 px-3 text-sm disabled:opacity-40">
          Re-check
        </button>
      </form>
      {result && <p role="status" className={`mt-2 text-sm ${result.ok ? "text-green-700" : "text-red-500"}`}>{result.message}</p>}
    </section>
  );
}
