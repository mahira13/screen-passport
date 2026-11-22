import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TripForm } from "@/components/TripForm";
import { startCity } from "@/lib/cities";
import { getCities } from "@/lib/cities-server";
import { getLiveData } from "@/lib/live-data";
import { TRIP_MODES, nearestCity, parseFrom, parseWorkIds, selectTripStops } from "@/lib/trip";

export const metadata: Metadata = { title: "Create a trip · Screen Passport", robots: { index: false } };

export default function NewTripPage(props: PageProps<"/trip/new">) {
  return (
    <main className="relative w-full overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-screen-2xl px-4 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12 [&>*]:max-w-2xl">
      <Link href="/" className="label inline-flex min-h-11 items-center text-ink/70 hover:text-accent">← Back</Link>
      <p className="label mt-8 text-accent">02 — Explore</p>
      <h1 className="mt-3 font-serif text-6xl leading-[0.92] tracking-tight sm:text-8xl">Create a <span className="italic text-accent">trip.</span></h1>
      <Suspense fallback={<p className="label mt-6 text-ink/60">Loading…</p>}>
        <NewTrip searchParams={props.searchParams} />
      </Suspense>
      </div>
    </main>
  );
}

async function NewTrip({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const cities = await getCities();
  const fallback = startCity(cities);
  const start = parseFrom(one(q.from), cities) ?? parseFrom(fallback.id, cities)
    ?? { label: fallback.name, param: `${fallback.lat},${fallback.lng}`, lat: fallback.lat, lng: fallback.lng, tz: fallback.tz };
  const live = await getLiveData();
  const works = parseWorkIds(one(q.works)).flatMap((id) => {
    const w = live.works.find((x) => x.id === id);
    return w ? [{ id: w.id, title: w.title }] : [];
  });

  if (works.length === 0) {
    return (
      <p className="mt-6 text-lg text-ink/80">
        Pick a title first: tap <strong>Create a trip</strong> on a title card.{" "}
        <Link href="/discover#index" className="text-accent underline underline-offset-4">Find filming places</Link>
      </p>
    );
  }

  const ids = works.map((w) => w.id);
  const placesByMode = Object.fromEntries(
    TRIP_MODES.map((m) => [m, selectTripStops(live.locations, live.works, ids, start, m, "full").length]),
  ) as Record<(typeof TRIP_MODES)[number], number>;

  return (
    <>
      <p className="mt-6 font-serif text-2xl italic leading-snug text-ink/90">
        {works.map((w) => w.title).join(", ")} <span className="not-italic text-ink/60">· from {start.label}</span>
      </p>
      <p className="mt-2 text-sm text-ink/70">
        We pick the closest filming places and put them in a sensible order. Friends can join with a link.
      </p>
      <div className="mt-10 border-t border-ink/15 pt-8">
        <TripForm works={works} from={{ param: start.param, label: start.label, tz: start.tz }} placesByMode={placesByMode}
          nearestCity={nearestCity(live.locations, ids, start)} />
      </div>
    </>
  );
}
