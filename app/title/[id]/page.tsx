import type { Metadata } from "next";
import { ShareLink } from "@/components/ShareLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { PhotoCard } from "@/components/PhotoCard";
import { PlacesMapBox } from "@/components/PlacesMapBox";
import { StartCollection } from "@/components/StartCollection";
import { findCityByName } from "@/lib/cities";
import { getCities } from "@/lib/cities-server";
import { catalogueIds, loadTitle } from "@/lib/catalogue-loaders";
import { siteUrl } from "@/lib/site-url";
import { TrackView } from "@/components/TrackView";

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";

export async function generateStaticParams() {
  const { titles } = await catalogueIds();
  return titles.map((id) => ({ id }));
}

const summary = (n: number, cities: number, countries: number) =>
  `${n} filming ${n === 1 ? "place" : "places"} in ${cities} ${cities === 1 ? "city" : "cities"}${countries > 1 ? ` across ${countries} countries` : ""}`;

export async function generateMetadata(props: PageProps<"/title/[id]">): Promise<Metadata> {
  const t = await loadTitle((await props.params).id);
  if (!t) return { title: "Title · Screen Passport" };
  const cities = t.countries.reduce((n, c) => n + c.cities.length, 0);
  const description = `Where ${t.work.title} was filmed: ${summary(t.places.length, cities, t.countries.length)}, each with a source.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: `${t.work.title}: filming locations · Screen Passport`,
    description,
    openGraph: { title: `Where ${t.work.title} was filmed`, description, type: "website", url: `/title/${t.work.id}`, siteName: "Screen Passport" },
    twitter: { card: "summary_large_image", title: `Where ${t.work.title} was filmed`, description },
  };
}

export default function TitleRoute(props: PageProps<"/title/[id]">) {
  return (
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening…</p>}>
        <TitleView params={props.params} />
      </Suspense>
    </main>
  );
}

async function TitleView({ params }: { params: Promise<{ id: string }> }) {
  const t = await loadTitle((await params).id);
  if (!t) notFound();
  const { work, places, countries } = t;
  const cities = countries.reduce((n, c) => n + c.cities.length, 0);
  const from = findCityByName(await getCities(), t.mainCity)?.id;
  const tripHref = `/trip/new?works=${encodeURIComponent(work.id)}${from ? `&from=${from}` : ""}`;

  return (
    <>
      <TrackView page="title" id={work.id} />
      <section className={`${WRAP} pt-4 sm:pt-10`}>
        <div className="-mx-4 sm:mx-0">
          <Cover photo={places.find((p) => p.photo)?.photo ?? null} label={work.title} className="aspect-[16/10] sm:aspect-[21/9] sm:rounded-sm" priority />
        </div>
        <p className="label mt-6 text-accent">{work.type === "film" ? "Film" : "Series"}{work.year && ` · ${work.year}`}</p>
        <h1 className="mt-2 max-w-5xl font-display text-5xl leading-[0.95] tracking-tight sm:text-8xl">{work.title}</h1>
        <p className="mt-3 text-lg text-ink/70">{summary(places.length, cities, countries.length)}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StartCollection workId={work.id} placeIds={places.map((p) => p.id)} />
          <Link href={tripHref} className="label inline-flex min-h-11 items-center rounded-full border border-ink/30 px-5 transition-colors hover:border-accent hover:text-accent">
            Create a trip
          </Link>
          <ShareLink path={`/title/${encodeURIComponent(work.id)}`} title={work.title} what="title"
            text={`Where ${work.title} was filmed: ${places.length} real places to visit.`} />
        </div>
      </section>

      <div className={`${WRAP} mt-10`}>
        <PlacesMapBox pins={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, thumb: p.photo?.url, label: work.title }))} className="-mx-4 h-[50vh] max-h-[560px] min-h-[280px] sm:mx-0" />
      </div>

      <section className={`${WRAP} pt-14`}>
        {countries.map((c) => (
          <div key={c.country} className="mt-12 first:mt-0">
            {countries.length > 1 && <h2 className="font-display text-4xl tracking-tight sm:text-5xl">{c.country}</h2>}
            {c.cities.map((city) => (
              <div key={city.city} className="mt-6 first:mt-0">
                <h3 className="label text-accent">{city.city} · {city.places.length}</h3>
                <ul className="mt-4 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                  {city.places.map((p) => (
                    <li key={p.id}>
                      <PhotoCard href={`/location/${p.id}`} title={p.name} photo={p.photo} aspect="aspect-[16/10]"
                        meta={(p.depicts || p.sceneNote) && <p className="line-clamp-2">{p.depicts ? `As ${p.depicts}` : p.sceneNote}</p>} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
