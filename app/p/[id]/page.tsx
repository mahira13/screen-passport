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
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
      <Suspense fallback={<p className="text-sm text-navy/60">Opening passport…</p>}>
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
      <header className="rounded-2xl bg-navy p-6 text-cream">
        <p className="font-display text-sm uppercase tracking-widest text-gold">Screen Passport · {city.name} edition</p>
        {passport.display_name && <p className="mt-1 text-lg">{passport.display_name}</p>}
        <p className="mt-4 font-display text-5xl font-bold">{allPlaces.length}</p>
        <p className="text-base">
          filming {allPlaces.length === 1 ? "place" : "places"} from {stamps.length} {stamps.length === 1 ? "title" : "titles"} near {city.name}
        </p>
        {closest && (
          <p className="mt-3 text-sm text-cream/80">
            Closest: {closest.name} ({closest.title}), {formatDistance(closest.distanceKm)}
          </p>
        )}
      </header>

      <YourPassportNote passportId={passport.id} />
      {stamps.length > 0 && <ShareCard passportId={passport.id} data={card} />}

      {stamps.length === 0 ? (
        <p className="mt-6 text-sm">No titles in this passport yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stamps.map((s) => (
            <li key={s.work.id}
              className={`flex aspect-square flex-col items-center justify-center rounded-full border-2 border-dashed p-3 text-center ${
                s.visited ? "border-navy bg-gold" : "border-navy/40 bg-white"
              }`}>
              <span className="font-display text-sm font-semibold leading-tight">{s.work.title}</span>
              <span className="mt-1 text-xs text-navy/70">
                {s.places.length} {s.places.length === 1 ? "place" : "places"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {stamps.some((s) => s.places.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy/70">Places to visit</h2>
          {stamps.filter((s) => s.places.length > 0).map((s) => (
            <div key={s.work.id} className="mt-3">
              <h3 className="font-display font-semibold">{s.work.title}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {s.places.map((p) => (
                  <li key={p.id}>
                    {visited.has(p.id) && "★ "}
                    {p.name}
                    {p.city && <span className="text-navy/60">, {p.city}</span>}
                    <span className="text-navy/60"> · {formatDistance(p.distanceKm)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <Link href="/" className="mt-8 block rounded-full bg-navy px-5 py-3 text-center font-semibold text-cream">
        Find filming places near you
      </Link>
    </>
  );
}
