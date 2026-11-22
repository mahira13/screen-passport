"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

type Search = { requestId: number; text: string; done: boolean; href: string | null; status: string };
type State =
  | { kind: "idle" | "sending" }
  | { kind: "known" | "error"; text: string }
  | { kind: "search"; search: Search };

const POLL_MS = 5000;

/**
 * "Find filming locations for <title>" -> /api/request. Starts a search for verified places and
 * shows its status (queued, searching, found N, nothing verified). Never answers with AI: only
 * places that passed verification are ever linked.
 */
type Props = { near?: string; initialTitle?: string; source?: "trip" | "search" };

export function RequestBox({ near, initialTitle = "", source = "trip" }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [state, setState] = useState<State>({ kind: "idle" });

  // Poll while the search runs; each poll also moves the search on (server side).
  const searchId = state.kind === "search" && !state.search.done ? state.search.requestId : null;
  useEffect(() => {
    if (searchId === null) return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/request/${searchId}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const s = (await res.json()) as Search;
        setState({ kind: "search", search: s });
        if (s.done) track("request_created", { from: source, result: s.status });
      } catch {
        // keep polling; a missed poll changes nothing
      }
    }, POLL_MS);
    return () => { stop = true; clearInterval(timer); };
  }, [searchId, source]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that. Try again.");
      if (json.known) {
        setState({ kind: "known", text: "We already have that one. Its places show up when they're near your start." });
      } else {
        track("request_created", { from: source });
        setState({ kind: "search", search: json as Search });
      }
    } catch (err) {
      setState({ kind: "error", text: err instanceof Error ? err.message : "Couldn't save that. Try again." });
    }
  };

  const busy = state.kind === "sending" || (state.kind === "search" && !state.search.done);
  const label = source === "search"
    ? (title.trim() ? `Find filming locations for “${title.trim()}”` : "Find filming locations")
    : "Request";

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor={`request-title-${source}`} className={source === "search" ? "sr-only" : "text-sm font-medium"}>
        {source === "search" ? "Title to search for" : `Which film or series should we add${near ? ` near ${near}` : ""}?`}
      </label>
      <div className={`mt-1 flex gap-2 ${source === "search" ? "flex-col sm:flex-row" : ""}`}>
        <input id={`request-title-${source}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required
          className="min-w-0 flex-1 border border-ink/25 bg-surface px-4 py-2.5 focus:border-accent focus:outline-none" placeholder="Title" />
        <button type="submit" disabled={busy}
          className="label shrink-0 bg-accent px-5 py-2.5 text-paper transition-colors hover:bg-ink disabled:opacity-60">
          {label}
        </button>
      </div>
      {(state.kind === "known" || state.kind === "error") && (
        <p role="status" className={`mt-2 text-sm ${state.kind === "error" ? "text-red-400" : ""}`}>{state.text}</p>
      )}
      {state.kind === "search" && (
        <p role="status" aria-live="polite" className="mt-2 flex flex-wrap items-center gap-x-3 text-sm">
          {!state.search.done && <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />}
          <span>{state.search.text}</span>
          {state.search.href && (
            <Link href={state.search.href} className="label text-accent underline-offset-4 hover:underline">See the places →</Link>
          )}
          {!state.search.done && <span className="text-xs text-ink/60">Every place is checked against a trusted source before it shows.</span>}
        </p>
      )}
    </form>
  );
}
