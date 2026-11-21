import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { JoinTrip } from "@/components/JoinTrip";
import { OrganiserPanel } from "@/components/OrganiserPanel";
import { ReportTrip } from "@/components/ReportTrip";
import { TripActions, TripMapBox } from "@/components/TripActions";
import { formatDistance } from "@/lib/distance";
import { isTripId } from "@/lib/ids";
import { directionsUrl } from "@/lib/links";
import { googleMapsRouteUrl, kmBetweenStops } from "@/lib/route";
import { formatTripDate, LENGTH_LABEL, MODE_LABEL, shareText, tripLaylaPrompt, tzLabel } from "@/lib/trip";
import { getTrip } from "@/lib/trip-server";

const loadTrip = cache(async (id: string) => (isTripId(id) && process.env.SUPABASE_SERVICE_ROLE_KEY ? getTrip(id) : null));
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata(props: PageProps<"/trip/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const trip = await loadTrip(id);
  if (!trip) return { title: "Trip · Screen Passport", robots: { index: false } };
  const description = `${formatTripDate(trip.startsAt, trip.timeZone)} · ${trip.stops.length} filming places · meet at ${trip.meetingPoint}. Join ${trip.organiser} on Screen Passport.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: `${trip.title} · Screen Passport`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: trip.title, description, type: "website", url: `/trip/${trip.id}`, siteName: "Screen Passport" },
    twitter: { card: "summary_large_image", title: trip.title, description },
  };
}

export default function TripPage(props: PageProps<"/trip/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
      <Suspense fallback={<p className="text-sm text-navy/60">Opening trip…</p>}>
        <TripView params={props.params} />
      </Suspense>
    </main>
  );
}

async function TripView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) notFound();

  const url = `${siteUrl()}/trip/${trip.id}`;
  const km = kmBetweenStops(trip.stops);
  const meeting = trip.stops[0];

  return (
    <>
      <header className="rounded-2xl bg-navy p-6 text-cream">
        <p className="font-display text-sm uppercase tracking-widest text-gold">Screen Passport · fan trip</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight">{trip.title}</h1>
        <p className="mt-3 text-lg font-semibold">{formatTripDate(trip.startsAt, trip.timeZone)}</p>
        <p className="mt-1 text-sm text-cream/80">
          {MODE_LABEL[trip.mode]} · {LENGTH_LABEL[trip.length]} · {trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"}
          {trip.stops.length > 1 && ` · ${formatDistance(km)} between stops`}
        </p>
        <p className="mt-1 text-sm text-cream/80">Organised by {trip.organiser}</p>
      </header>

      {trip.intro && <p className="mt-4 text-base">{trip.intro}</p>}

      <div className="mt-4">
        <TripActions tripId={trip.id} routeUrl={googleMapsRouteUrl(trip.stops, trip.mode)} transit={trip.mode === "transit"}
          laylaPrompt={tripLaylaPrompt(trip.startsAt, trip.timeZone, trip.stops)} shareTitle={trip.title}
          shareText={shareText(trip.title, trip.startsAt, trip.timeZone, url)} shareUrl={url} />
      </div>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">Meeting point</h2>
        <p className="mt-1 font-semibold">{trip.meetingPoint}</p>
        {meeting && (
          <p className="text-sm">
            {trip.meetingIsFirstStop ? "Stop 1 on the map" : `Then start at stop 1, ${meeting.name}`}
            {meeting.city && `, ${meeting.city}`} ·{" "}
            <a href={directionsUrl(meeting)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              Directions
            </a>
          </p>
        )}
        <TripMapBox stops={trip.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
      </section>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">Stops</h2>
        <ol className="mt-2 space-y-3">
          {trip.stops.map((s, i) => (
            <li key={s.id} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-navy/10">
              <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${i === 0 ? "bg-gold text-navy" : "bg-navy text-cream"}`}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-navy/70">
                  {s.plan.time && <span className="font-semibold text-navy">{s.plan.time} · </span>}
                  {s.plan.travel_from_previous}
                </p>
                <h3 className="font-display text-lg font-semibold leading-tight">{s.name}</h3>
                <p className="text-xs text-navy/60">{s.title}{s.city && ` · ${s.city}`}</p>
                {(s.plan.why_fans_love_it ?? s.sceneNote) && <p className="mt-1 text-sm">{s.plan.why_fans_love_it ?? s.sceneNote}</p>}
                {s.visitNote && <p className="mt-1 text-xs text-navy/70">{s.visitNote}</p>}
                <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold underline underline-offset-2">
                  Directions
                </a>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-navy/60">
          Distances are straight-line and approximate. Times are a rough guide, in {tzLabel(trip.timeZone)} time.
        </p>
      </section>

      {trip.plan.tips.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">Tips</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {trip.plan.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}

      <JoinTrip tripId={trip.id} organiser={trip.organiser} joined={trip.joined} />

      <p className="mt-4 rounded-xl bg-cream p-3 text-xs text-navy/80 ring-1 ring-navy/10">
        Stay safe: meet in a public place, and don&apos;t share personal details. A first name is all you need here.
      </p>
      <div className="mt-3">
        <ReportTrip tripId={trip.id} />
      </div>

      <OrganiserPanel tripId={trip.id} url={url} />

      <Link href="/" className="mt-8 block rounded-full bg-navy px-5 py-3 text-center font-semibold text-cream">
        Find filming places near you
      </Link>
    </>
  );
}
