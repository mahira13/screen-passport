"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type State = { kind: "idle" | "sending" } | { kind: "done" | "error"; text: string };

/** "Which title should we add?" -> /api/request. Never answers with AI, only counts the request. */
type Props = { near?: string; initialTitle?: string; source?: "trip" | "search" };

export function RequestBox({ near, initialTitle = "", source = "trip" }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [state, setState] = useState<State>({ kind: "idle" });

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
        setState({ kind: "done", text: "We already have that one. Its places show up when they're near your start." });
      } else {
        track("request_created", { from: source });
        setState({ kind: "done", text: "Thanks, we'll add it." });
        setTitle("");
      }
    } catch (err) {
      setState({ kind: "error", text: err instanceof Error ? err.message : "Couldn't save that. Try again." });
    }
  };

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor={`request-title-${source}`} className="text-sm font-medium">
        {source === "search" ? "Ask us to add it" : `Which film or series should we add${near ? ` near ${near}` : ""}?`}
      </label>
      <div className="mt-1 flex gap-2">
        <input id={`request-title-${source}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required
          className="min-w-0 flex-1 border border-ink/25 bg-surface px-4 py-2.5 focus:border-accent focus:outline-none" placeholder="Title" />
        <button type="submit" disabled={state.kind === "sending"}
          className="label shrink-0 bg-accent px-5 py-2.5 text-night transition-colors hover:bg-ink disabled:opacity-60">
          Request
        </button>
      </div>
      {(state.kind === "done" || state.kind === "error") && (
        <p role="status" className={`mt-2 text-sm ${state.kind === "error" ? "text-red-400" : ""}`}>{state.text}</p>
      )}
    </form>
  );
}
