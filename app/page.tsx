import { HomeSearch } from "@/components/HomeSearch";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { PhotoCard } from "@/components/PhotoCard";
import { homeData } from "@/lib/page-data";

const ENTRIES = [
  { href: "/discover?near=1", title: "Near me", meta: "Filming places around you" },
  { href: "/collections", title: "Collections", meta: "Visit them all, fill your passport" },
  { href: "/trip/new", title: "Trips", meta: "Plan a day out and invite friends" },
] as const;

export default async function Home() {
  const { covers, examples } = await homeData();
  return (
    <main className="mx-auto w-full max-w-screen-xl px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
      <LegacyHashRedirect />
      <h1 className="max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        Find where your favourite films and series were shot <span className="text-accent">— near you.</span>
      </h1>
      <div id="search" className="mt-8 max-w-2xl scroll-mt-24"><HomeSearch examples={examples} /></div>
      <ul className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-5">
        {ENTRIES.map((e, i) => (
          <li key={e.href}>
            <PhotoCard href={e.href} title={e.title} meta={e.meta} photo={covers[i]} aspect="aspect-[4/3] sm:aspect-[3/4]" big priority={i === 0} />
          </li>
        ))}
      </ul>
    </main>
  );
}
