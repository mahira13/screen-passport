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
import { buildInvite } from "@/lib/invite-card";
import { directionsUrl } from "@/lib/links";
import { googleMapsRouteUrl, kmBetweenStops } from "@/lib/route";
import { formatTripDate, LENGTH_LABEL, MODE_LABEL, shareText, tripLaylaPrompt, tzLabel } from "@/lib/trip";
import { getTrip, type TripView } from "@/lib/trip-server";

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
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

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
      <Suspense fallback={<p className="text-sm text-ink/60">Opening trip…</p>}>
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
        <h1 className="font-display text-2xl font-bold">We can&apos;t open this trip right now</h1>
        <p className="mt-2 text-ink/80">Something went wrong on our side. Please try again in a minute.</p>
        <Link href="/" className="mt-6 inline-block rounded bg-ink px-5 py-3 font-semibold text-paper">
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
      <header className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 pb-8 pt-6 sm:pt-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Fan trip</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">{trip.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-ink/70 sm:text-lg">
          <span className="font-semibold text-ink">{formatTripDate(trip.startsAt, trip.timeZone)}</span>
          <span aria-hidden>·</span>
          <span>{MODE_LABEL[trip.mode]}</span>
          <span aria-hidden>·</span>
          <span>{LENGTH_LABEL[trip.length]}</span>
          <span aria-hidden>·</span>
          <span>{trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"}</span>
          {trip.stops.length > 1 && (<><span aria-hidden>·</span><span>{formatDistance(km)} between stops</span></>)}
        </div>
        <p className="mt-1 text-sm text-ink/50">Organised by {trip.organiser}</p>
        {trip.intro && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink/85">{trip.intro}</p>}
        <div className="mt-6">
          <TripActions tripId={trip.id} routeUrl={googleMapsRouteUrl(trip.stops, trip.mode)} transit={trip.mode === "transit"}
            laylaPrompt={tripLaylaPrompt(trip.startsAt, trip.timeZone, trip.stops)} shareTitle={trip.title}
            shareText={shareText(trip.title, trip.startsAt, trip.timeZone, url)} shareUrl={url} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Meeting point</h2>
            <p className="mt-1 text-xl font-bold">{trip.meetingPoint}</p>
            {meeting && (
              <p className="text-sm text-ink/70">
                {trip.meetingIsFirstStop ? "Stop 1 on the map" : `Then start at stop 1, ${meeting.name}`}
                {meeting.city && `, ${meeting.city}`} ·{" "}
                <a href={directionsUrl(meeting)} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
                  Directions
                </a>
              </p>
            )}
          </section>

          {/* On phones the map sits here; on large screens it sticks to the right. */}
          <div className="lg:hidden">
            <TripMapBox stops={trip.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
          </div>

          <section className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Stops</h2>
            <ol className="mt-3 space-y-2">
              {trip.stops.map((s, i) => (
                <li key={s.id} className="flex gap-4 rounded-md bg-surface p-4 transition-colors hover:bg-[#262626]">
                  <span aria-hidden className={`text-4xl font-black leading-none tabular-nums ${i === 0 ? "text-accent" : "text-ink/25"}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink/60">
                      {s.plan.time && <span className="font-bold text-ink">{s.plan.time} · </span>}
                      {s.plan.travel_from_previous}
                    </p>
                    <h3 className="mt-0.5 text-lg font-bold leading-tight">{s.name}</h3>
                    <p className="text-xs text-ink/50">{s.title}{s.city && ` · ${s.city}`}</p>
                    {(s.plan.why_fans_love_it ?? s.sceneNote) && <p className="mt-2 text-sm text-ink/85">{s.plan.why_fans_love_it ?? s.sceneNote}</p>}
                    {s.visitNote && <p className="mt-1 text-xs text-ink/60">{s.visitNote}</p>}
                    <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-semibold text-ink/80 hover:text-ink hover:underline">
                      Directions →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink/50">
              Distances are straight-line and approximate. Times are a rough guide, in {tzLabel(trip.timeZone)} time.
            </p>
          </section>

          {trip.plan.tips.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Tips</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
                {trip.plan.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
          )}

          <JoinTrip tripId={trip.id} organiser={trip.organiser} joined={trip.joined} />

          <InviteCard tripId={trip.id} data={buildInvite({
            title: trip.title, filmTitles: trip.stops.map((s) => s.title), startsAt: trip.startsAt, timeZone: trip.timeZone,
            meetingPoint: trip.meetingPoint, stops: trip.stops.length, joined: trip.joined.length, url,
          })} />

          <p className="mt-4 rounded-md border border-ink/10 p-3 text-xs text-ink/70">
            Stay safe: meet in a public place, and don&apos;t share personal details. A first name is all you need here.
          </p>
          <div className="mt-3">
            <ReportTrip tripId={trip.id} />
          </div>

          <OrganiserPanel tripId={trip.id} url={url} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <TripMapBox tall stops={trip.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
          </div>
        </aside>
      </div>
    </>
  );
}
