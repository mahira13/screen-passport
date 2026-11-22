import Link from "next/link";
import { findCityByName } from "@/lib/cities";
import { getCities } from "@/lib/cities-server";
import type { CollectionModel } from "@/lib/collections-model";
import { centreOf } from "@/lib/discover";
import { challengeGoal } from "@/lib/challenges";
import { ChallengeFriends } from "./ChallengeFriends";
import { CollectionVisits } from "./CollectionVisits";
import { Cover } from "./Cover";
import { InfoTip } from "./InfoTip";
import { PhotoCard } from "./PhotoCard";
import { PlacesMapBox } from "./PlacesMapBox";
import { ShareLink } from "./ShareLink";
import { TrackView } from "./TrackView";

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";
const KIND = { curated: "Collection", title: "Title collection", city: "City collection" } as const;

/** One collection (curated or automatic): cover card, progress, map and its places. */
export async function CollectionView({ c }: { c: CollectionModel }) {
  const notYet = c.places.filter((p) => !p.checkIn).length;
  // A trip from the collection's city when it is a start city, else from the centre of its places.
  const centre = centreOf(c.places);
  const from = findCityByName(await getCities(), c.city)?.id ?? (centre ? `${centre.lat},${centre.lng}` : null);
  const tripHref = c.works.length
    ? `/trip/new?works=${encodeURIComponent(c.works.slice(0, 10).map((w) => w.id).join(","))}${from ? `&from=${encodeURIComponent(from)}` : ""}`
    : null;
  return (
    <>
      <TrackView page="collection" id={c.key} />
      <section className={`${WRAP} pt-4 sm:pt-10`}>
        <div className="-mx-4 sm:mx-0">
          <Cover photo={c.cover} label={c.name} className="aspect-[16/10] sm:aspect-[21/9] sm:rounded-sm" priority />
        </div>
        <p className="label mt-6 text-accent">{KIND[c.kind]}{c.city && ` · ${c.city}`} · {c.places.length} places</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">{c.name}</h1>
        {c.description && <p className="mt-3 max-w-2xl text-lg text-ink/70 line-clamp-2">{c.description}</p>}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1"><CollectionVisits placeIds={c.places.map((p) => p.id)} /></div>
              {notYet > 0 && (
                <InfoTip label="About check-in">{notYet} {notYet === 1 ? "place has" : "places have"} only an approximate pin, so check-in isn&apos;t offered there yet.</InfoTip>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {tripHref && (
                <Link href={tripHref} className="label inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-paper transition-colors hover:bg-ink">
                  Create a trip
                </Link>
              )}
              {challengeGoal(c.places).length > 0 && <ChallengeFriends collection={c.key} />}
              <ShareLink path={c.href} title={c.name} text={`${c.name}: ${c.places.length} real filming places to visit.`} what="collection" />
            </div>
          </div>
          <PlacesMapBox pins={c.places.map((p) => ({ ...p, label: p.titles[0] ?? p.name }))} className="-mx-4 h-[45vh] max-h-[480px] min-h-[260px] sm:mx-0" />
        </div>
      </section>

      <section className={`${WRAP} pt-12`}>
        <ul className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {c.places.map((p) => (
            <li key={p.id}>
              <PhotoCard href={`/location/${p.id}`} title={p.name} photo={p.image} aspect="aspect-[16/10]"
                meta={<p className="truncate">{[p.city, p.titles.join(" · ")].filter(Boolean).join(" · ")}</p>} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
