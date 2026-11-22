import type { Metadata } from "next";
import { ShareLink } from "@/components/ShareLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckInButton } from "@/components/CheckInButton";
import { DirectionsLink } from "@/components/DirectionsLink";
import { DistanceFromMe } from "@/components/DistanceFromMe";
import { PlacePhoto } from "@/components/PlacePhoto";
import { PlacesMapBox } from "@/components/PlacesMapBox";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ACCESS_TEXT, CONFIDENCE_TEXT } from "@/lib/catalogue-pages";
import { catalogueIds, loadLocation } from "@/lib/catalogue-loaders";
import { siteUrl } from "@/lib/site-url";

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";

export async function generateStaticParams() {
  const { locations } = await catalogueIds();
  return locations.map((id) => ({ id: String(id) }));
}

const titlesText = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export async function generateMetadata(props: PageProps<"/location/[id]">): Promise<Metadata> {
  const l = await loadLocation((await props.params).id);
  if (!l) return { title: "Place · Screen Passport" };
  const where = [l.place.city, l.country].filter(Boolean).join(", ");
  const description = `Filmed here: ${titlesText(l.titles.map((t) => t.title))}.${where ? ` ${where}.` : ""} Directions, access and the source.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: `${l.place.name} · Screen Passport`,
    description,
    openGraph: { title: l.place.name, description, type: "website", url: `/location/${l.place.id}`, siteName: "Screen Passport" },
    twitter: { card: "summary_large_image", title: l.place.name, description },
  };
}

export default function LocationRoute(props: PageProps<"/location/[id]">) {
  return (
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening…</p>}>
        <LocationView params={props.params} />
      </Suspense>
    </main>
  );
}

async function LocationView({ params }: { params: Promise<{ id: string }> }) {
  const l = await loadLocation((await params).id);
  if (!l) notFound();
  const p = l.place;
  const where = [p.city, l.region !== p.city ? l.region : null, l.country].filter(Boolean).join(" · ");

  return (
    <article className={`${WRAP} pt-10 sm:pt-16`}>
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          {where && <p className="label text-accent">{where}</p>}
          <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">{p.name}</h1>
          {l.address && <p className="mt-4 text-lg text-ink/75">{l.address}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 text-sm text-ink/70">
            {l.confidence && <span>{CONFIDENCE_TEXT[l.confidence]}</span>}
            {!l.checkIn && <span>Approximate location, so check-in isn&apos;t offered</span>}
            <VerifiedBadge by={p.verifiedBy} />
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {l.checkIn && <CheckInButton place={p} />}
            <DirectionsLink place={p} />
            <DistanceFromMe to={p} />
            <ShareLink path={`/location/${p.id}`} title={p.name} what="location"
              text={`${p.name}: filming location of ${l.titles.map((t) => t.title).slice(0, 3).join(", ")}.`} />
          </div>

          <div className="mt-8 border-l-2 border-accent bg-surface/60 p-4">
            <p className="label text-ink/60">Visiting</p>
            <p className="mt-2 text-ink/85">{ACCESS_TEXT[l.access]}</p>
            {p.visitNote && <p className="mt-1 text-sm text-ink/70">{p.visitNote}</p>}
          </div>
        </div>
        <div>
          <PlacePhoto photo={p.photo} name={p.name} />
          <PlacesMapBox pins={[{ id: p.id, name: p.name, lat: p.lat, lng: p.lng }]} className={`h-72 ${p.photo ? "mt-4" : ""}`} />
        </div>
      </div>

      <section className="mt-16">
        <p className="label text-accent">Filmed here</p>
        <ul className="mt-4 border-t border-ink/20">
          {l.titles.map((t) => (
            <li key={t.workId} className="border-b border-ink/15 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Link href={`/title/${t.workId}`} className="font-serif text-3xl leading-tight transition-colors hover:text-accent sm:text-4xl">{t.title}</Link>
                <span className="label text-ink/60">{t.type === "film" ? "Film" : "Series"}{t.year && ` · ${t.year}`}</span>
              </div>
              {t.depicts && <p className="mt-2 font-serif text-xl italic text-accent">Stands in for {t.depicts}</p>}
              {t.sceneNote && <p className="mt-2 max-w-2xl text-ink/80">{t.sceneNote}</p>}
              {t.sourceUrl && (
                <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="label mt-3 inline-flex min-h-11 items-center gap-1 text-ink/70 transition-colors hover:text-accent">
                  Source{t.sourceName && <span className="normal-case tracking-normal">· {t.sourceName}</span>} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
