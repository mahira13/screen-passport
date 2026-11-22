"use client";

import { useId, useState } from "react";
import { normaliseTitle } from "@/lib/match";
import type { NearbyTitle } from "@/lib/nearby";
import { RequestBox } from "./RequestBox";

const MAX_RESULTS = 6;

/** Picks a title from our own list. Text that matches nothing can become a request, never an AI answer. */
export function TitleSearch({ titles, onPick }: { titles: NearbyTitle[]; onPick: (workId: string) => void }) {
  const [q, setQ] = useState("");
  const listId = useId();
  const needle = normaliseTitle(q);
  const results = needle ? titles.filter((t) => normaliseTitle(t.title).includes(needle)).slice(0, MAX_RESULTS) : [];
  const nothing = needle.length >= 2 && results.length === 0;

  const pick = (id: string) => {
    onPick(id);
    setQ("");
  };

  return (
    <div>
      <label htmlFor={`${listId}-q`} className="label text-ink/60">Search a film or series</label>
      <div className="mt-2 flex items-stretch border-b-2 border-ink/40 transition-colors focus-within:border-accent">
        <input id={`${listId}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder="Dark, Babylon Berlin, Bridge of Spies…" aria-controls={listId}
          onKeyDown={(e) => e.key === "Enter" && results[0] && (e.preventDefault(), pick(results[0].workId))}
          className="min-w-0 flex-1 bg-transparent py-3 font-serif text-2xl text-ink placeholder:text-ink/55 focus:outline-none sm:text-3xl" />
        <span aria-hidden className="self-center font-condensed text-xl tracking-wider text-accent">Find ↘</span>
      </div>
      <ul id={listId} aria-live="polite" className="mt-1">
        {results.map((t) => (
          <li key={t.workId}>
            <button type="button" onClick={() => pick(t.workId)}
              className="flex w-full items-baseline justify-between gap-3 border-b border-ink/10 py-3 text-left transition-colors hover:text-accent">
              <span className="font-serif text-xl">{t.title}</span>
              <span className="label shrink-0 text-ink/60">{t.placeCount} {t.placeCount === 1 ? "place" : "places"} · {t.type}</span>
            </button>
          </li>
        ))}
      </ul>
      {nothing && (
        <div className="mt-3 border-l-2 border-accent pl-4">
          <p className="text-sm text-ink/80">We don&apos;t have &quot;{q.trim()}&quot; yet.</p>
          <RequestBox key={needle} initialTitle={q.trim()} source="search" />
        </div>
      )}
    </div>
  );
}
