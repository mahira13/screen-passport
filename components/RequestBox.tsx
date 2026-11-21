"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type State = { kind: "idle" | "sending" } | { kind: "done" | "error"; text: string };

/** "Which title should we add?" -> /api/request. Never answers with AI, only counts the request. */
export function RequestBox({ near }: { near?: string }) {
  const [title, setTitle] = useState("");
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
        track("request_created", { from: "trip" });
        setState({ kind: "done", text: "Thanks, we'll add it." });
        setTitle("");
      }
    } catch (err) {
      setState({ kind: "error", text: err instanceof Error ? err.message : "Couldn't save that. Try again." });
    }
  };

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="request-title" className="text-sm font-medium">
        Which film or series should we add{near ? ` near ${near}` : ""}?
      </label>
      <div className="mt-1 flex gap-2">
        <input id="request-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required
          className="min-w-0 flex-1 rounded-full border border-navy/30 bg-white px-4 py-2" placeholder="Title" />
        <button type="submit" disabled={state.kind === "sending"}
          className="shrink-0 rounded-full bg-navy px-4 py-2 font-semibold text-cream disabled:opacity-60">
          Request
        </button>
      </div>
      {(state.kind === "done" || state.kind === "error") && (
        <p role="status" className={`mt-2 text-sm ${state.kind === "error" ? "text-red-800" : ""}`}>{state.text}</p>
      )}
    </form>
  );
}
