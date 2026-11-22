import Link from "next/link";
import type { CollectionModel } from "@/lib/collections-model";
import { CollectionVisits } from "./CollectionVisits";
import { PhotoCredit } from "./PlacePhoto";
import { PlacesMapBox } from "./PlacesMapBox";
import { ScenePlate } from "./ScenePlate";

const WRAP = "mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12";
const KIND = { curated: "Collection", title: "Title collection", city: "City collection" } as const;

/** One collection (curated or automatic): cover card, progress, map and its places. */
export function CollectionView({ c }: { c: CollectionModel }) {
  const notYet = c.places.filter((p) => !p.checkIn).length;
  return (
    <>
      <section className={`${WRAP} pt-10 sm:pt-16`}>
        <ScenePlate index={1} className="aspect-[4/3] sm:aspect-[2.39/1]">
          {c.cover && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cover.url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
              <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f182b] via-[#0f182b]/40 to-transparent" />
            </>
          )}
          <p className="label text-ink/75">{KIND[c.kind]}{c.city && ` · ${c.city}`} · {c.places.length} places</p>
          <h1 className="mt-2 font-serif text-5xl leading-[0.9] tracking-tight text-ink sm:text-7xl">{c.name}</h1>
        </ScenePlate>
        {c.cover && <PhotoCredit photo={c.cover} />}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            {c.description && <p className="font-serif text-2xl italic leading-snug text-ink/80">{c.description}</p>}
            <div className="mt-6"><CollectionVisits placeIds={c.places.map((p) => p.id)} /></div>
            {notYet > 0 && (
              <p className="mt-2 text-xs text-ink/60">{notYet} {notYet === 1 ? "place needs" : "places need"} a verified pin before check-in.</p>
            )}
          </div>
          <PlacesMapBox pins={c.places} className="-mx-4 h-[45vh] max-h-[480px] min-h-[260px] sm:mx-0" />
        </div>
      </section>

      <section className={`${WRAP} pt-12`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.places.map((p) => (
            <li key={p.id}>
              <Link href={`/location/${p.id}`} className="group block h-full border-l-2 border-accent/60 bg-surface/60 p-4 transition-colors hover:bg-surface">
                <p className="font-serif text-2xl leading-tight transition-colors group-hover:text-accent">{p.name}</p>
                <p className="label mt-1 text-ink/60">{[p.city, p.titles.join(" · ")].filter(Boolean).join(" · ")}</p>
                <p className="mt-2 text-xs text-ink/60">{p.checkIn ? "Check-in on site" : "Approximate location, no check-in"}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
