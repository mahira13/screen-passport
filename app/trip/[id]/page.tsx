import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { InfoTip } from "@/components/InfoTip";
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
      <TrackView page="trip" id={trip.id} />
      <header className="mx-auto w-full max-w-screen-2xl px-4 pt-4 sm:px-8 sm:pt-10 lg:px-12">
        <div className="-mx-4 sm:mx-0">
          <Cover photo={trip.stops.find((s) => s.photo)?.photo ?? null} label={trip.title} className="aspect-[16/10] sm:aspect-[21/9] sm:rounded-sm" priority />
        </div>
        <p className="label mt-6 text-accent">Fan trip · by {trip.organiser}</p>
        <h1 className="mt-2 max-w-5xl font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">{trip.title}</h1>
        <p className="mt-3 text-lg text-ink/80">{formatTripDate(trip.startsAt, trip.timeZone)}</p>
        <p className="text-ink/60">
          {MODE_LABEL[trip.mode]} · {LENGTH_LABEL[trip.length]} · {trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"}
          {trip.stops.length > 1 && ` · ${formatDistance(km)}`}
        </p>
        {trip.intro && <p className="mt-5 max-w-3xl text-lg leading-snug text-ink/80">{trip.intro}</p>}
        <div className="mt-6">
          <TripActions tripId={trip.id} routeUrl={googleMapsRouteUrl(trip.stops, trip.mode)} transit={trip.mode === "transit"}
            laylaPrompt={tripLaylaPrompt(trip.startsAt, trip.timeZone, trip.stops)} shareTitle={trip.title}
            shareText={shareText(trip.title, trip.startsAt, trip.timeZone, url)} shareUrl={url} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-screen-2xl gap-10 px-4 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-12">
        <div className="min-w-0">
          <section>
            <h2 className="label text-accent">Meet at</h2>
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
            <div className="flex items-center gap-1">
              <h2 className="font-display text-3xl sm:text-4xl">The route</h2>
              <InfoTip label="About times and distances">Distances are straight-line and approximate. Times are a rough guide, in {tzLabel(trip.timeZone)} time.</InfoTip>
            </div>
            <ol className="mt-4">
              {trip.stops.map((s, i) => (
                <li key={s.id} className="flex gap-4 border-b border-ink/10 py-5 last:border-0">
                  <div className="relative w-24 shrink-0 sm:w-32">
                    <Cover photo={s.photo} label={s.title} credit={false} className="aspect-square rounded-sm" />
                    <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent font-display text-sm text-paper">{i + 1}</span>
                  </div>
                  <div className="min-w-0">
                    {(s.plan.time || s.plan.travel_from_previous) && (
                      <p className="label text-ink/60">
                        {s.plan.time && <span className="text-accent">{s.plan.time}</span>}
                        {s.plan.time && s.plan.travel_from_previous && " · "}
                        {s.plan.travel_from_previous}
                      </p>
                    )}
                    <h3 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{s.name}</h3>
                    <p className="text-accent">{s.title}{s.city && <span className="text-ink/60"> · {s.city}</span>}</p>
                    {(s.plan.why_fans_love_it ?? s.sceneNote) && <p className="mt-2 line-clamp-2 text-sm text-ink/75">{s.plan.why_fans_love_it ?? s.sceneNote}</p>}
                    <div className="flex flex-wrap items-center gap-x-4">
                      <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer"
                        className="label inline-flex min-h-11 items-center text-accent hover:text-ink">Directions →</a>
                      {s.photo && (
                        <a href={s.photo.page} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ink/50 hover:text-ink">
                          Photo: {s.photo.author} · {s.photo.license}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
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

          <p className="mt-8 text-xs text-ink/70">Stay safe: meet in public and share only your first name.</p>
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
