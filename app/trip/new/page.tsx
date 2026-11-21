import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TripForm } from "@/components/TripForm";
import { DEFAULT_CITY } from "@/lib/cities";
import { getLiveData } from "@/lib/live-data";
import { TRIP_MODES, nearestCity, parseFrom, parseWorkIds, selectTripStops } from "@/lib/trip";

export const metadata: Metadata = { title: "Create a trip · Screen Passport", robots: { index: false } };

export default function NewTripPage(props: PageProps<"/trip/new">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
      <Link href="/" className="text-sm underline underline-offset-2">← Back</Link>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Create a trip</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-navy/60">Loading…</p>}>
        <NewTrip searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function NewTrip({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const start = parseFrom(one(q.from)) ?? parseFrom(DEFAULT_CITY.id)!;
  const live = await getLiveData();
  const works = parseWorkIds(one(q.works)).flatMap((id) => {
    const w = live.works.find((x) => x.id === id);
    return w ? [{ id: w.id, title: w.title }] : [];
  });

  if (works.length === 0) {
    return (
      <p className="mt-4">
        Pick a title first: tap <strong>Create a trip</strong> on a title card.{" "}
        <Link href="/" className="underline">Find filming places</Link>
      </p>
    );
  }

  const ids = works.map((w) => w.id);
  const placesByMode = Object.fromEntries(
    TRIP_MODES.map((m) => [m, selectTripStops(live.locations, live.works, ids, start, m, "full").length]),
  ) as Record<(typeof TRIP_MODES)[number], number>;

  return (
    <>
      <p className="mt-1 text-navy/80">
        {works.map((w) => w.title).join(", ")} · from {start.label}
      </p>
      <p className="mt-1 text-sm text-navy/70">
        We pick the closest filming places and put them in a sensible order. Friends can join with a link.
      </p>
      <div className="mt-6">
        <TripForm works={works} from={{ param: start.param, label: start.label, tz: start.tz }} placesByMode={placesByMode}
          nearestCity={nearestCity(live.locations, ids, start)} />
      </div>
    </>
  );
}
