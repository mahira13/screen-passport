import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlacesMapBox } from "@/components/PlacesMapBox";
import { StartCollection } from "@/components/StartCollection";
import { findCityByName } from "@/lib/cities";
import { getCities } from "@/lib/cities-server";
import { catalogueIds, loadTitle } from "@/lib/catalogue-loaders";
import { siteUrl } from "@/lib/site-url";

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
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className={`${WRAP} relative pb-10 pt-12 sm:pt-20`}>
          <p className="label text-accent">{work.type === "film" ? "Film" : "Series"}{work.year && ` · ${work.year}`}</p>
          <h1 className="mt-4 max-w-5xl font-serif text-6xl leading-[0.92] tracking-tight sm:text-8xl">{work.title}</h1>
          <p className="mt-5 font-serif text-2xl italic text-ink/75 sm:text-3xl">{summary(places.length, cities, countries.length)}.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <StartCollection workId={work.id} placeIds={places.map((p) => p.id)} />
            <Link href={tripHref} className="label inline-flex min-h-11 items-center border border-ink/30 px-5 transition-colors hover:border-accent hover:text-accent">
              Create a trip
            </Link>
          </div>
        </div>
      </section>

      <div className={WRAP}>
        <PlacesMapBox pins={places} className="-mx-4 h-[50vh] max-h-[560px] min-h-[280px] sm:mx-0" />
      </div>

      <section className={`${WRAP} pt-14`}>
        {countries.map((c) => (
          <div key={c.country} className="mt-10 first:mt-0">
            <h2 className="flex items-baseline gap-3 border-b border-ink/20 pb-3">
              <span className="font-condensed text-4xl tracking-wide sm:text-5xl">{c.country}</span>
              <span className="label ml-auto text-ink/60">{c.count} {c.count === 1 ? "place" : "places"}</span>
            </h2>
            {c.cities.map((city) => (
              <div key={city.city} className="mt-6">
                <h3 className="font-serif text-2xl italic text-accent">{city.city}</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {city.places.map((p) => (
                    <li key={p.id}>
                      <Link href={`/location/${p.id}`} className="group block h-full border-l-2 border-accent/60 bg-surface/60 p-4 transition-colors hover:bg-surface">
                        <p className="font-serif text-2xl leading-tight transition-colors group-hover:text-accent">{p.name}</p>
                        {(p.depicts || p.sceneNote) && <p className="mt-2 text-sm text-ink/75">{p.depicts ? `As ${p.depicts}. ` : ""}{p.sceneNote}</p>}
                        <p className="label mt-3 text-ink/60">View place →</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        <p className="mt-12 max-w-xl text-sm text-ink/60">Every place has a source. Open a place to see it, how it was checked and how to visit.</p>
      </section>
    </>
  );
}
