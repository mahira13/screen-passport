import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareCard } from "@/components/ShareCard";
import { YourPassportNote } from "@/components/YourPassportNote";
import { DEFAULT_CITY, findCity } from "@/lib/cities";
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
    <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 pb-16 pt-6">
      <Suspense fallback={<p className="text-sm text-ink/60">Opening passport…</p>}>
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
  const stamps = passport.watched
    .map((workId) => {
      const work = live.works.find((w) => w.id === workId);
      const places = nearby.places.filter((p) => p.workId === workId);
      return work && { work, places, visited: places.some((p) => visited.has(p.id)) };
    })
    .filter((s) => !!s);
  const allPlaces = stamps.flatMap((s) => s.places).sort((a, b) => a.distanceKm - b.distanceKm);
  const card = buildCardData({
    cityName: city.name,
    displayName: passport.display_name,
    collections: live.collections,
    stamps: stamps.map((s) => ({ workId: s.work.id, title: s.work.title, places: s.places, visited: s.visited })),
  });
  const closest = allPlaces[0];

  return (
    <>
      <header className="pb-4 pt-2 sm:pt-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Screen Passport · {city.name} edition</p>
        {passport.display_name && <p className="mt-2 text-xl font-semibold">{passport.display_name}</p>}
        <p className="mt-4 text-7xl font-black leading-none tracking-tight sm:text-8xl">{allPlaces.length}</p>
        <p className="mt-2 text-lg text-ink/70">
          filming {allPlaces.length === 1 ? "place" : "places"} from {stamps.length} {stamps.length === 1 ? "title" : "titles"} near {city.name}
        </p>
        {closest && (
          <p className="mt-3 text-sm text-ink/60">
            Closest: {closest.name} ({closest.title}), {formatDistance(closest.distanceKm)}
          </p>
        )}
      </header>

      <YourPassportNote passportId={passport.id} />
      {stamps.length > 0 && (
        <Link href={`/trip/new?works=${encodeURIComponent(stamps.slice(0, 10).map((s) => s.work.id).join(","))}&from=${city.id}`}
          className="mt-4 block rounded border border-ink/30 bg-surface px-5 py-3 text-center font-semibold">
          Create a trip
        </Link>
      )}
      {stamps.length > 0 && <ShareCard passportId={passport.id} data={card} />}

      {stamps.length === 0 ? (
        <p className="mt-6 text-sm">No titles in this passport yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stamps.map((s) => (
            <li key={s.work.id}
              className={`flex aspect-square flex-col items-center justify-center rounded-full border-2 border-dashed p-3 text-center ${
                s.visited ? "border-accent bg-accent text-white" : "border-ink/30 bg-surface"
              }`}>
              <span className="text-sm font-bold leading-tight">{s.work.title}</span>
              <span className="mt-1 text-xs opacity-70">
                {s.places.length} {s.places.length === 1 ? "place" : "places"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {stamps.some((s) => s.places.length > 0) && (
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">Places to visit</h2>
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {stamps.filter((s) => s.places.length > 0).map((s) => (
            <div key={s.work.id} className="mt-3">
              <h3 className="font-bold">{s.work.title}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {s.places.map((p) => (
                  <li key={p.id}>
                    {visited.has(p.id) && "★ "}
                    {p.name}
                    {p.city && <span className="text-ink/60">, {p.city}</span>}
                    <span className="text-ink/60"> · {formatDistance(p.distanceKm)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </div>
        </section>
      )}

      <Link href="/" className="mt-10 inline-block rounded bg-ink px-6 py-3 font-bold text-paper hover:bg-ink/85">
        Find filming places near you
      </Link>
    </>
  );
}
