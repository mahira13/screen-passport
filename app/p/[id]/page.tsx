import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareCard } from "@/components/ShareCard";
import { YourPassportNote } from "@/components/YourPassportNote";
import { DEFAULT_CITY, findCity } from "@/lib/cities";
import { collectionProgress, visitProgress } from "@/lib/collections";
import { formatDistance } from "@/lib/distance";
import { isPassportId } from "@/lib/ids";
import { getLiveData } from "@/lib/live-data";
import { buildNearby } from "@/lib/nearby";
import { buildCardData } from "@/lib/share-card";
import { supabasePublic } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "A Screen Passport",
  description: "Filming places from films and series someone has watched.",
  robots: { index: false, follow: false },
};

type Passport = { id: string; display_name: string | null; start_city: string | null; watched: string[]; visited: number[] };

export default function PassportPage(props: PageProps<"/p/[id]">) {
  return (
    <main className="w-full">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening passport…</p>}>
        <PassportView params={props.params} />
      </Suspense>
    </main>
  );
}

async function PassportView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isPassportId(id) || !process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  // get_passport: read by exact id only (nobody can list passports).
  const { data, error } = await supabasePublic().rpc("get_passport", { p_id: id });
  if (error) throw new Error(error.message);
  const passport = (data as Passport[])[0];
  if (!passport) notFound();

  const city = findCity(passport.start_city) ?? DEFAULT_CITY;
  const live = await getLiveData();
  const nearby = buildNearby(live.locations, live.works, city);
  const visited = new Set(passport.visited);
  // A stamp per watched title, plus any title with a check-in (visiting counts even unwatched).
  const stampIds = [...new Set([...passport.watched, ...nearby.places.filter((p) => visited.has(p.id)).map((p) => p.workId)])];
  const stamps = stampIds
    .map((workId) => {
      const work = live.works.find((w) => w.id === workId);
      const places = nearby.places.filter((p) => p.workId === workId);
      return work && { work, places, visited: places.some((p) => visited.has(p.id)) };
    })
    .filter((s) => !!s);
  // One entry per physical place, even when it was filmed for several watched titles.
  const allPlaces = [...new Map(stamps.flatMap((s) => s.places).map((p) => [p.id, p])).values()]
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const card = buildCardData({
    cityName: city.name,
    displayName: passport.display_name,
    collections: live.collections,
    stamps: stamps.map((s) => ({ workId: s.work.id, title: s.work.title, places: s.places, visited: s.visited })),
  });
  const closest = allPlaces[0];
  const goldStamps = stamps.filter((s) => s.visited).length;
  // Collection progress = places checked in; watched titles are the second line. A badge = every place.
  const collections = live.collections
    .map((c) => {
      const placeIds = [...new Set(nearby.places.filter((p) => c.work_ids.includes(p.workId)).map((p) => p.id))];
      const v = visitProgress(placeIds, passport.visited);
      const w = collectionProgress(c, passport.watched);
      return { id: c.id, name: c.name, ...v, watchedDone: w.done, watchedTotal: w.total };
    })
    .filter((c) => c.total > 0 && (c.done > 0 || c.watchedDone > 0))
    .sort((a, b) => b.done / b.total - a.done / a.total || b.watchedDone - a.watchedDone);
  const complete = collections.filter((c) => c.complete).length;
  const mrz = `P<SCREEN<PASSPORT<<${city.name.toUpperCase().normalize("NFKD").replace(/[^A-Z]/g, "")}`.padEnd(44, "<");
  const mrz2 = `${passport.id.toUpperCase().replace(/[^A-Z0-9]/g, "")}<<${allPlaces.length}PLACES<<${stamps.length}TITLES`.padEnd(44, "<").slice(0, 44);
  const stats: [number, string][] = [
    [allPlaces.length, allPlaces.length === 1 ? "Place" : "Places"],
    [stamps.length, stamps.length === 1 ? "Title" : "Titles"],
    [goldStamps, goldStamps === 1 ? "Gold stamp" : "Gold stamps"],
    [complete, "Collections done"],
  ];
  const tripHref = `/trip/new?works=${encodeURIComponent(stamps.slice(0, 10).map((s) => s.work.id).join(","))}&from=${city.id}`;
  const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";

  return (
    <>
      {/* Cover and data page */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-0 h-[32rem] w-[32rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className={`${WRAP} relative grid gap-10 pb-14 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16`}>
          <div className="grain mx-auto flex aspect-[5/7] w-full max-w-[300px] flex-col items-center justify-between border border-accent/40 bg-surface px-6 py-10 text-center text-accent shadow-2xl shadow-black/50 lg:mx-0">
            <p className="label relative z-[2]">{city.name} edition</p>
            <div className="relative z-[2]">
              <svg viewBox="0 0 100 100" className="mx-auto h-24 w-24" aria-hidden>
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <circle key={a} cx={50 + 20 * Math.cos((a * Math.PI) / 180)} cy={50 + 20 * Math.sin((a * Math.PI) / 180)} r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                ))}
                <circle cx="50" cy="50" r="4" fill="currentColor" />
              </svg>
              <p className="mt-6 font-condensed text-4xl leading-none tracking-[0.14em]">Screen</p>
              <p className="font-condensed text-4xl leading-none tracking-[0.14em]">Passport</p>
            </div>
            <p className="relative z-[2] font-serif text-lg italic">Discover · Explore · Collect</p>
          </div>

          <div className="flex min-w-0 flex-col">
            <p className="label text-ink/60">Passport no. <span className="text-ink">{passport.id}</span></p>
            <p className="label mt-6 text-ink/60">Holder</p>
            <h1 className="mt-1 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              {passport.display_name ?? <span className="italic">A film lover</span>}
            </h1>
            <p className="mt-3 text-lg text-ink/70">
              {allPlaces.length} filming {allPlaces.length === 1 ? "place" : "places"} from {stamps.length} {stamps.length === 1 ? "title" : "titles"} near {city.name}
            </p>

            <dl className="mt-8 grid grid-cols-2 border-t border-ink/15 sm:grid-cols-4">
              {stats.map(([n, label]) => (
                <div key={label} className="border-b border-ink/15 py-4 pr-4 sm:border-b-0">
                  <dt className="label text-ink/60">{label}</dt>
                  <dd className="mt-1 font-condensed text-6xl leading-none text-accent">{n}</dd>
                </div>
              ))}
            </dl>
            {closest && (
              <p className="mt-4 text-sm text-ink/65">
                Closest: <span className="text-ink">{closest.name}</span> ({closest.title}), {formatDistance(closest.distanceKm)}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {stamps.length > 0 && (
                <Link href={tripHref} className="label bg-accent px-5 py-3.5 text-paper transition-colors hover:bg-ink">
                  Create a trip →
                </Link>
              )}
              <Link href="/discover#index" className="label border border-ink/30 px-5 py-3.5 transition-colors hover:border-accent hover:text-accent">
                Add more titles
              </Link>
            </div>
            <YourPassportNote passportId={passport.id} />

            <p aria-hidden className="mt-auto select-none overflow-hidden whitespace-nowrap pt-10 font-mono text-[11px] leading-relaxed tracking-[0.2em] text-ink/40 sm:text-xs">
              {mrz}<br />{mrz2}
            </p>
          </div>
        </div>
      </section>

      {/* Stamp pages */}
      <section className="border-t border-ink/10 py-14 sm:py-20">
        <div className={WRAP}>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/20 pb-5">
            <h2 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">Stamps<span className="italic text-accent">.</span></h2>
            <p className="label text-ink/60">Gold means checked in on site</p>
          </div>
          {stamps.length === 0 ? (
            <p className="mt-8 font-serif text-2xl italic text-ink/70">No titles in this passport yet.</p>
          ) : (
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {stamps.map((s, i) => (
                <li key={s.work.id} style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}
                  className={`mx-auto flex aspect-square w-full max-w-[180px] flex-col items-center justify-center rounded-full border-[3px] border-double p-4 text-center ${
                    s.visited ? "border-paper bg-accent text-paper" : "border-ink/50 text-ink"
                  }`}>
                  <span className="label text-[9px] opacity-80">{s.work.type === "series" ? "Series" : "Film"}{s.work.year ? ` · ${s.work.year}` : ""}</span>
                  <span className="mt-1 font-serif text-xl leading-[1.05]">{s.work.title}</span>
                  <span className="mt-1.5 font-condensed text-base tracking-[0.15em]">
                    {s.visited ? "Checked in" : `${s.places.length} ${s.places.length === 1 ? "place" : "places"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {collections.length > 0 && (
            <div className="mt-16">
              <p className="label text-accent">Collections</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {collections.map((c) => (
                  <li key={c.id} className={`relative bg-surface p-5 ${c.complete ? "ring-1 ring-accent" : ""}`}>
                    <p className="font-serif text-2xl leading-tight">{c.name}</p>
                    <p className={`mt-2 font-condensed text-4xl leading-none text-accent`}>
                      {c.done}<span className="text-ink/60">/{c.total}</span>
                    </p>
                    <div className="mt-3 flex gap-1" role="img" aria-label={`Visited ${c.done} of ${c.total} places`}>
                      {Array.from({ length: c.total }, (_, k) => (
                        <span key={k} className={`h-1 flex-1 ${k < c.done ? "bg-accent" : "bg-ink/15"}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-ink/70">
                      Visited {c.done} of {c.total} {c.total === 1 ? "place" : "places"}
                      {c.watchedTotal > 1 && ` · Watched ${c.watchedDone} of ${c.watchedTotal} titles`}
                    </p>
                    {c.complete && <span className="label absolute right-4 top-4 rotate-[8deg] border border-accent px-2 py-0.5 text-accent">Complete</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Travel journal */}
      {stamps.some((s) => s.places.length > 0) && (
        <section className="border-t border-ink/10 py-14 sm:py-20">
          <div className={WRAP}>
            <p className="label text-accent">Travel journal</p>
            <h2 className="mt-3 font-serif text-5xl leading-none tracking-tight sm:text-6xl">Places to visit</h2>
            <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {stamps.filter((s) => s.places.length > 0).map((s) => (
                <div key={s.work.id} className="border-t border-ink/15 pt-4">
                  <h3 className="font-serif text-2xl italic text-accent">{s.work.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {s.places.map((p) => (
                      <li key={p.id} className="flex items-baseline gap-2">
                        <span aria-hidden className={visited.has(p.id) ? "text-accent" : "text-ink/40"}>{visited.has(p.id) ? "★" : "○"}</span>
                        <span className="min-w-0 flex-1">
                          {p.name}
                          {p.city && <span className="text-ink/60">, {p.city}</span>}
                        </span>
                        <span className="label shrink-0 text-ink/60">{formatDistance(p.distanceKm)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {stamps.length > 0 && (
        <div className={WRAP}>
          <ShareCard passportId={passport.id} data={card} />
        </div>
      )}

      <div className={`${WRAP} py-14`}>
        <Link href="/" className="group inline-flex items-baseline gap-3 font-serif text-4xl tracking-tight hover:text-accent sm:text-5xl">
          Find filming places near you <span className="italic text-accent transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </>
  );
}

const TILT = [-6, 4, -2, 7, -4, 2];
