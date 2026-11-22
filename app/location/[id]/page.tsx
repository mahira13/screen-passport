import type { Metadata } from "next";
import { ShareLink } from "@/components/ShareLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckInButton } from "@/components/CheckInButton";
import { PostcardAfterCheckIn } from "@/components/PostcardAfterCheckIn";
import { DirectionsLink } from "@/components/DirectionsLink";
import { DistanceFromMe } from "@/components/DistanceFromMe";
import { Cover } from "@/components/Cover";
import { InfoTip } from "@/components/InfoTip";
import { PlacesMapBox } from "@/components/PlacesMapBox";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ACCESS_TEXT, CONFIDENCE_TEXT } from "@/lib/catalogue-pages";
import { catalogueIds, loadLocation } from "@/lib/catalogue-loaders";
import { siteUrl } from "@/lib/site-url";
import { TrackView } from "@/components/TrackView";

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
    <article className={`${WRAP} pt-4 sm:pt-10`}>
      <TrackView page="location" id={String(p.id)} />
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
        <div className="relative -mx-4 sm:mx-0 lg:order-2">
          <Cover photo={p.photo} label={p.title} className="aspect-[4/3] sm:rounded-sm" priority />
          <VerifiedBadge by={p.verifiedBy} className="absolute left-4 top-3 z-10 sm:left-3" />
        </div>
        <div className="lg:order-1">
          {where && <p className="label text-accent">{where}</p>}
          <div className="mt-3 flex items-start gap-1">
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">{p.name}</h1>
            <InfoTip label="About this place" className="mt-1 shrink-0">
              {l.address && <span className="block">{l.address}</span>}
              {l.confidence && <span className="mt-1 block">{CONFIDENCE_TEXT[l.confidence]}.</span>}
              {!l.checkIn && <span className="mt-1 block">Approximate location, so check-in isn&apos;t offered.</span>}
              {p.visitNote && <span className="mt-1 block">{p.visitNote}</span>}
            </InfoTip>
          </div>
          <p className="mt-3 text-ink/75">{ACCESS_TEXT[l.access]}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {l.checkIn && <CheckInButton place={p} />}
            <DirectionsLink place={p} />
            <DistanceFromMe to={p} />
            <ShareLink path={`/location/${p.id}`} title={p.name} what="location"
              text={`${p.name}: filming location of ${l.titles.map((t) => t.title).slice(0, 3).join(", ")}.`} />
          </div>
          {l.checkIn && l.titles[0] && <PostcardAfterCheckIn placeId={p.id} place={p.name} title={l.titles[0].title} />}
          <PlacesMapBox pins={[{ id: p.id, name: p.name, lat: p.lat, lng: p.lng, thumb: p.photo?.url, label: p.title }]} className="mt-8 h-56 sm:h-72" />
        </div>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-3xl sm:text-4xl">Filmed here</h2>
        <ul className="mt-2">
          {l.titles.map((t) => (
            <li key={t.workId} className="border-b border-ink/10 py-5 last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Link href={`/title/${t.workId}`} className="font-display text-3xl leading-tight transition-colors hover:text-accent sm:text-4xl">{t.title}</Link>
                <span className="label text-ink/60">{t.type === "film" ? "Film" : "Series"}{t.year && ` · ${t.year}`}</span>
              </div>
              {(t.depicts || t.sceneNote) && (
                <p className="mt-2 max-w-2xl text-accent">{t.depicts ? `Stands in for ${t.depicts}` : t.sceneNote}</p>
              )}
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
