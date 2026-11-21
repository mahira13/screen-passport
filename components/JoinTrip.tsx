"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { FIRST_NAME_MAX, MAX_JOINS } from "@/lib/trip";

export function JoinTrip({ tripId, organiser, joined }: { tripId: string; organiser: string; joined: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const full = joined.length >= MAX_JOINS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/trip/${tripId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't join. Try again.");
      track("trip_joined", { trip: tripId });
      setDone(true);
      setName("");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't join. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-8 rounded-md bg-surface p-4 ring-1 ring-ink/10">
      <h2 className="font-display text-lg font-semibold">Who&apos;s coming</h2>
      <ul className="mt-2 flex flex-wrap gap-2 text-sm">
        <li className="rounded bg-accent px-3 py-1 font-medium">{organiser} (organiser)</li>
        {joined.map((n, i) => (
          <li key={i} className="rounded bg-paper px-3 py-1 ring-1 ring-ink/10">{n}</li>
        ))}
      </ul>
      {done ? (
        <p role="status" className="mt-3 text-sm font-medium">You&apos;re in. See you there!</p>
      ) : full ? (
        <p className="mt-3 text-sm">This trip is full.</p>
      ) : (
        <form onSubmit={submit} className="mt-3">
          <label htmlFor="join-name" className="text-sm font-medium">Join with your first name</label>
          <div className="mt-1 flex gap-2">
            <input id="join-name" required maxLength={FIRST_NAME_MAX} autoComplete="given-name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded border border-ink/30 bg-paper/40 px-4 py-2" />
            <button type="submit" disabled={sending}
              className="shrink-0 rounded bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-60">
              Join
            </button>
          </div>
          {message && <p role="alert" className="mt-2 text-sm text-red-400">{message}</p>}
        </form>
      )}
    </section>
  );
}
