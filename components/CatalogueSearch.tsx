"use client";

import { useEffect, useId, useState } from "react";
import { track } from "@/lib/analytics";
import type { SearchHit } from "@/lib/discover";
import { normaliseTitle } from "@/lib/match";
import { RequestBox } from "./RequestBox";

const KIND: Record<SearchHit["kind"], string> = { work: "Title", city: "City", country: "Country" };
type State = { q: string; hits: SearchHit[] } | { q: string; error: true };

/**
 * Search by film, series, city or country (search_catalogue). Picks only what is in our catalogue;
 * text that matches nothing can become a request, never an AI answer.
 */
/** examples: a few real titles and places from the catalogue, shown as the placeholder. */
export function CatalogueSearch({ onPick, examples }: { onPick: (hit: SearchHit) => void; examples: string[] }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [attempt, setAttempt] = useState(0); // "Try again" re-runs the search
  const listId = useId();
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((json: { results: SearchHit[] }) => {
          setState({ q: term, hits: json.results.slice(0, 8) });
          if (json.results.length === 0) track("search", { results: 0 }); // no query text: it could be anything
        })
        .catch((e) => e.name !== "AbortError" && setState({ q: term, error: true }));
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term, attempt]);

  const current = state && state.q === term && term.length >= 2 ? state : null;
  const hits = current && "hits" in current ? current.hits : [];
  const nothing = !!current && "hits" in current && hits.length === 0;

  const pick = (hit: SearchHit) => {
    track("search", { results: hits.length, kind: hit.kind, id: hit.id });
    onPick(hit);
    setQ("");
  };

  return (
    <div>
      <label htmlFor={`${listId}-q`} className="label text-ink/60">Search a film, series, city or country</label>
      <div className="mt-2 flex items-stretch border-b-2 border-ink/40 transition-colors focus-within:border-accent">
        <input id={`${listId}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder={examples.length ? `${examples.join(", ")}…` : "A film, series or city…"} aria-controls={listId}
          onKeyDown={(e) => e.key === "Enter" && hits[0] && (e.preventDefault(), pick(hits[0]))}
          className="min-w-0 flex-1 bg-transparent py-3 font-display text-2xl text-ink placeholder:text-ink/55 focus:outline-none sm:text-3xl" />
        <span aria-hidden className="self-center font-display text-xl tracking-wider text-accent">Find ↘</span>
      </div>
      <ul id={listId} aria-live="polite" className="mt-1">
        {hits.map((h) => (
          <li key={`${h.kind}:${h.id}`}>
            <button type="button" onClick={() => pick(h)} disabled={h.kind !== "work" && !h.centre}
              className="flex w-full items-baseline justify-between gap-3 border-b border-ink/10 py-3 text-left transition-colors hover:text-accent disabled:opacity-50">
              <span className="font-display text-xl">{h.label}</span>
              <span className="label shrink-0 text-ink/60">{KIND[h.kind]} · {h.places} {h.places === 1 ? "place" : "places"}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && "error" in current && (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-red-400">
          <span>Search is unavailable right now.</span>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}
            className="label inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline">Try again</button>
        </p>
      )}
      {nothing && (
        <div className="mt-3 border-l-2 border-accent pl-4">
          <p className="text-sm text-ink/80">We don&apos;t have &quot;{term}&quot; yet.</p>
          <RequestBox key={normaliseTitle(term)} initialTitle={term} source="search" />
        </div>
      )}
    </div>
  );
}
