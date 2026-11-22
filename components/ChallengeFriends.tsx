"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { ensurePassport } from "@/lib/passport-store";
import { FIRST_NAME_MAX } from "@/lib/trip";

const input = "min-w-0 flex-1 border-b-2 border-ink/30 bg-transparent px-1 py-2 text-lg focus:border-accent focus:outline-none";
const button = "label inline-flex min-h-11 shrink-0 items-center bg-accent px-5 text-paper transition-colors hover:bg-ink disabled:opacity-60";

async function post(url: string, body: Record<string, unknown>): Promise<Response> {
  const { id, editKey } = await ensurePassport();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, passportId: id, editKey }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
  return res;
}

/** First name form shared by "Challenge friends" and "Join". */
function NameForm({ label, cta, onSubmit }: { label: string; cta: string; onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="challenge-name" className="label text-ink/60">{label}</label>
      <div className="mt-1 flex gap-2">
        <input id="challenge-name" required maxLength={FIRST_NAME_MAX} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <button type="submit" disabled={busy} className={button}>{busy ? "…" : cta}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}

/** On a collection page: start a challenge, then land on its page to share it. */
export function ChallengeFriends({ collection }: { collection: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="label inline-flex min-h-11 items-center border border-accent px-4 text-accent transition-colors hover:bg-accent hover:text-paper">
        Challenge friends
      </button>
    );
  }
  return (
    <div className="w-full max-w-md">
      <NameForm label="Your first name, so friends know who challenged them" cta="Start" onSubmit={async (firstName) => {
        const res = await post("/api/challenge", { collection, firstName });
        const { id } = (await res.json()) as { id: string };
        track("challenge_created", { collection });
        router.push(`/challenge/${id}`);
      }} />
    </div>
  );
}

/** On a challenge page. */
export function JoinChallenge({ id, full }: { id: string; full: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="mt-4 font-display text-xl text-accent">You&apos;re in. Check in on site to move up.</p>;
  if (full) return <p className="mt-3 text-sm">This challenge is full (50 people).</p>;
  return (
    <NameForm label="Join with your first name" cta="Join" onSubmit={async (firstName) => {
      await post(`/api/challenge/${id}/join`, { firstName });
      track("challenge_joined", { challenge: id });
      setDone(true);
      router.refresh();
    }} />
  );
}
