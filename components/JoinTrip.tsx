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
    <section className="mt-12 border-t-2 border-accent bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-3xl">Who&apos;s coming</h2>
        <span className="label text-smoke">{joined.length + 1} going</span>
      </div>
      {/* First names only, as people typed them. */}
      <ul className="mt-4 flex flex-wrap gap-2 text-sm">
        <li className="flex items-center gap-2 bg-accent py-1 pl-1 pr-3 font-medium text-night">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-night font-condensed text-base text-accent">
            {organiser.charAt(0).toUpperCase()}
          </span>
          {organiser} <span className="label text-[9px] text-night/70">organiser</span>
        </li>
        {joined.map((n, i) => (
          <li key={i} className="flex items-center gap-2 border border-ink/15 py-1 pl-1 pr-3">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-burgundy font-condensed text-base text-cream">
              {n.charAt(0).toUpperCase()}
            </span>
            {n}
          </li>
        ))}
      </ul>
      {done ? (
        <p role="status" className="mt-4 font-serif text-xl italic text-accent">You&apos;re in. See you there!</p>
      ) : full ? (
        <p className="mt-3 text-sm">This trip is full.</p>
      ) : (
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="join-name" className="label text-smoke">Join with your first name</label>
          <div className="mt-1 flex gap-2">
            <input id="join-name" required maxLength={FIRST_NAME_MAX} autoComplete="given-name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 border-b-2 border-ink/30 bg-transparent px-1 py-2 text-lg focus:border-accent focus:outline-none" />
            <button type="submit" disabled={sending}
              className="label shrink-0 bg-accent px-5 py-2.5 text-night transition-colors hover:bg-ink disabled:opacity-60">
              Join
            </button>
          </div>
          {message && <p role="alert" className="mt-2 text-sm text-red-400">{message}</p>}
        </form>
      )}
    </section>
  );
}
