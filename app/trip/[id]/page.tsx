import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { InviteCard } from "@/components/InviteCard";
import { JoinTrip } from "@/components/JoinTrip";
import { OrganiserPanel } from "@/components/OrganiserPanel";
import { ReportTrip } from "@/components/ReportTrip";
import { TripActions, TripMapBox } from "@/components/TripActions";
import { formatDistance } from "@/lib/distance";
import { isTripId } from "@/lib/ids";
import { siteUrl } from "@/lib/site-url";
import { buildInvite } from "@/lib/invite-card";
import { directionsUrl } from "@/lib/links";
import { googleMapsRouteUrl, kmBetweenStops } from "@/lib/route";
import { formatTripDate, LENGTH_LABEL, MODE_LABEL, shareText, tripLaylaPrompt, tzLabel } from "@/lib/trip";
import { getTrip, type TripView } from "@/lib/trip-server";
import { TrackView } from "@/components/TrackView";

// "failed": the database couldn't be read. Shown as a friendly message, not a crash page.
const loadTrip = cache(async (id: string): Promise<TripView | null | "failed"> => {
  if (!isTripId(id) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return await getTrip(id);
  } catch (e) {
    console.error("trip page:", e instanceof Error ? e.message : e);
    return "failed";
  }
});

export async function generateMetadata(props: PageProps<"/trip/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const trip = await loadTrip(id);
  if (!trip || trip === "failed") return { title: "Trip · Screen Passport", robots: { index: false } };
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
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening trip…</p>}>
        <TripView params={props.params} />
      </Suspense>
    </main>
  );
}

async function TripView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) notFound();
  if (trip === "failed") {
    return (
      <div className="px-4 pt-10 text-center">
        <h1 className="font-display text-4xl">We can&apos;t open this trip right now</h1>
        <p className="mt-2 text-ink/80">Something went wrong on our side. Please try again in a minute.</p>
        <Link href="/" className="label mt-6 inline-block bg-accent px-5 py-3.5 text-paper">
          Find filming places near you
        </Link>
      </div>
    );
  }

  const url = `${siteUrl()}/trip/${trip.id}`;
  const km = kmBetweenStops(trip.stops);
  const meeting = trip.stops[0];

  return (
    <>
      <header className="relative overflow-hidden">
      <TrackView page="trip" id={trip.id} />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-20 h-[32rem] w-[32rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className="relative mx-auto w-full max-w-screen-2xl px-4 pb-12 pt-10 sm:px-8 sm:pt-16 lg:px-12">
        <p className="label flex flex-wrap items-center gap-3 text-ink/60">
          <span className="text-accent">Fan trip</span><span aria-hidden className="h-px w-8 bg-ink/30" />
          <span>Organised by {trip.organiser}</span>
        </p>
        <h1 className="mt-5 max-w-5xl font-display text-5xl leading-[0.92] tracking-tight sm:text-7xl xl:text-8xl">{trip.title}</h1>
        <dl className="mt-8 grid max-w-4xl grid-cols-2 border-t border-ink/15 sm:grid-cols-4">
          {[
            ["When", formatTripDate(trip.startsAt, trip.timeZone)],
            ["Getting around", `${MODE_LABEL[trip.mode]} · ${LENGTH_LABEL[trip.length]}`],
            ["Stops", `${trip.stops.length} ${trip.stops.length === 1 ? "stop" : "stops"}`],
            ...(trip.stops.length > 1 ? [["Distance", `${formatDistance(km)} between stops`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="border-b border-ink/15 py-4 pr-4">
              <dt className="label text-ink/60">{k}</dt>
              <dd className="mt-1 font-display text-xl leading-tight">{v}</dd>
            </div>
          ))}
        </dl>
        {trip.intro && <p className="mt-6 max-w-3xl font-display text-2xl leading-snug text-ink/85">{trip.intro}</p>}
        <div className="mt-8">
          <TripActions tripId={trip.id} routeUrl={googleMapsRouteUrl(trip.stops, trip.mode)} transit={trip.mode === "transit"}
            laylaPrompt={tripLaylaPrompt(trip.startsAt, trip.timeZone, trip.stops)} shareTitle={trip.title}
            shareText={shareText(trip.title, trip.startsAt, trip.timeZone, url)} shareUrl={url} />
        </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-screen-2xl gap-10 px-4 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-12">
        <div className="min-w-0">
          <section>
            <h2 className="label text-accent">Meeting point</h2>
            <p className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{trip.meetingPoint}</p>
            {meeting && (
              <p className="text-sm text-ink/70">
                {trip.meetingIsFirstStop ? "Stop 1 on the map" : `Then start at stop 1, ${meeting.name}`}
                {meeting.city && `, ${meeting.city}`} ·{" "}
                <a href={directionsUrl(meeting)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                  Directions
                </a>
              </p>
            )}
          </section>

          {/* On phones the map sits here; on large screens it sticks to the right. */}
          <div className="lg:hidden">
            <TripMapBox stops={trip.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
          </div>

          <section className="mt-12">
            <h2 className="label text-accent">The route</h2>
            <ol className="mt-4 border-t border-ink/15">
              {trip.stops.map((s, i) => (
                <li key={s.id} className="flex gap-5 border-b border-ink/15 py-6">
                  <span aria-hidden className={`w-14 shrink-0 font-display text-5xl leading-[0.8] tabular-nums ${i === 0 ? "text-accent" : "text-ink/40"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="label text-ink/60">
                      {s.plan.time && <span className="text-accent">{s.plan.time} · </span>}
                      {s.plan.travel_from_previous}
                    </p>
                    <h3 className="mt-1.5 font-display text-3xl leading-tight">{s.name}</h3>
                    <p className="mt-0.5 font-display text-lg text-accent">{s.title}{s.city && <span className="text-ink/60"> · {s.city}</span>}</p>
                    {(s.plan.why_fans_love_it ?? s.sceneNote) && <p className="mt-3 text-ink/80">{s.plan.why_fans_love_it ?? s.sceneNote}</p>}
                    {s.visitNote && <p className="mt-1 text-xs text-ink/60">{s.visitNote}</p>}
                    <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer"
                      className="label mt-1 inline-flex min-h-11 items-center text-accent hover:text-ink">
                      Directions →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink/60">
              Distances are straight-line and approximate. Times are a rough guide, in {tzLabel(trip.timeZone)} time.
            </p>
          </section>

          {trip.plan.tips.length > 0 && (
            <section className="mt-12 border-l-2 border-accent bg-surface p-6">
              <h2 className="label text-accent">Tips</h2>
              <ul className="mt-3 space-y-3">
                {trip.plan.tips.map((t, i) => <li key={i} className="flex gap-3 font-display text-lg leading-snug"><span aria-hidden className="text-accent">✦</span>{t}</li>)}
              </ul>
            </section>
          )}

          <JoinTrip tripId={trip.id} organiser={trip.organiser} joined={trip.joined} />

          <InviteCard tripId={trip.id} data={buildInvite({
            title: trip.title, filmTitles: trip.stops.map((s) => s.title), startsAt: trip.startsAt, timeZone: trip.timeZone,
            meetingPoint: trip.meetingPoint, stops: trip.stops.length, joined: trip.joined.length, url,
          })} />

          <p className="mt-8 border-l-2 border-accent pl-3 text-xs text-ink/75">
            Stay safe: meet in a public place, and don&apos;t share personal details. A first name is all you need here.
          </p>
          <div className="mt-3">
            <ReportTrip tripId={trip.id} />
          </div>

          <OrganiserPanel tripId={trip.id} url={url} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 pb-12">
            <TripMapBox tall stops={trip.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
          </div>
        </aside>
      </div>
    </>
  );
}
