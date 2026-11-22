"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTripDate } from "@/lib/trip";
import { myTripRefs, type MyTripRef } from "@/lib/trip-keys";
import type { TripSummary } from "@/lib/trip-server";
import { PhotoCard } from "./PhotoCard";

type Loaded = { trips: (TripSummary & { role: MyTripRef["role"] })[] } | { error: true } | null;

/** Trips this browser created or joined. The IDs live only in this browser. */
export function MyTrips() {
  const [data, setData] = useState<Loaded>(null);

  useEffect(() => {
    const refs = myTripRefs();
    fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: refs.map((r) => r.id) }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { trips: TripSummary[] }) => {
        const now = new Date().toISOString();
        const upcoming = j.trips.filter((t) => t.startsAt >= now);
        const past = j.trips.filter((t) => t.startsAt < now).reverse();
        setData({ trips: [...upcoming, ...past].map((t) => ({ ...t, role: refs.find((r) => r.id === t.id)?.role ?? "joined" })) });
      })
      .catch(() => setData({ error: true }));
  }, []);

  if (data === null) return <p className="label mt-10 text-ink/60">Loading…</p>;
  if ("error" in data) return <p role="alert" className="mt-10 text-ink/70">Couldn&apos;t load your trips. Try again in a minute.</p>;
  if (!data.trips.length)
    return <p className="mt-10 text-lg text-ink/75">No trips yet. Create one and send the link to friends.</p>;

  const now = new Date().toISOString();
  return (
    <ul className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {data.trips.map((t) => (
        <li key={t.id}>
          <PhotoCard href={`/trip/${t.id}`} title={t.title} photo={t.photo}
            eyebrow={t.startsAt < now ? "Past" : t.role === "organiser" ? "Your trip" : "Joined"}
            meta={<>
              <p>{formatTripDate(t.startsAt, t.timeZone)}</p>
              <p>{t.city} · {t.people} going</p>
            </>} />
        </li>
      ))}
    </ul>
  );
}

export function CreateButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/trip/new" className={`label inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-paper transition-colors hover:bg-ink ${className}`}>
      + Create a trip
    </Link>
  );
}
