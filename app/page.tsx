import Link from "next/link";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { ScenePlate } from "@/components/ScenePlate";
import { homeCounts } from "@/lib/page-data";

const ENTRIES = [
  {
    href: "/discover?near=1",
    verb: "Find",
    title: "Filming locations near me",
    text: "Real places from films and series around you, each with a source.",
  },
  {
    href: "/discover#search",
    verb: "Explore",
    title: "A film or series",
    text: "Pick a title you love and see every place it was shot.",
  },
  {
    href: "/collections",
    verb: "Discover",
    title: "A cinematic collection",
    text: "Small adventures through one city's films. Visit them all to complete the set.",
  },
] as const;

export default async function Home() {
  const counts = await homeCounts();
  return (
    <main className="relative w-full overflow-hidden">
      <LegacyHashRedirect />
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -left-48 top-[28rem] h-[30rem] w-[30rem] rounded-full bg-accent/5 blur-[120px]" />

      <section className="relative mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-12 sm:px-8 sm:pt-20 lg:px-12 lg:pb-24">
        <p className="label flex flex-wrap items-center gap-x-3 gap-y-1 text-ink/60">
          <span className="text-accent">From the screen to the streets</span>
          {counts && counts.places > 0 && (
            <>
              <span aria-hidden className="h-px w-8 bg-ink/30" />
              <span>{counts.places} sourced places · {counts.titles} titles</span>
            </>
          )}
        </p>
        <h1 className="mt-6 max-w-5xl font-serif text-[3.1rem] leading-[0.92] tracking-tight sm:text-7xl xl:text-[6.5rem]">
          What cinematic <span className="italic text-accent">adventure</span> do you want to go on?
        </h1>

        <div aria-hidden className="sprockets mb-3 mt-12 h-3 w-full sm:mt-16" />
        <ul className="grid gap-3 md:grid-cols-3">
          {ENTRIES.map((e, i) => (
            <li key={e.href}>
              <Link href={e.href} className="group block h-full transition-transform duration-500 hover:-translate-y-1">
                <ScenePlate index={i} className="aspect-[4/3] h-full shadow-2xl shadow-black/60 md:aspect-[3/4] lg:aspect-[16/11]">
                  <p className="label text-ink/70">Reel {String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 font-serif text-3xl italic leading-none text-accent sm:text-4xl">{e.verb}</p>
                  <p className="mt-1 font-condensed text-4xl leading-[0.9] tracking-wide text-ink sm:text-5xl">{e.title}</p>
                  <p className="mt-3 max-w-xs text-sm text-ink/75">{e.text}</p>
                  <p className="label mt-4 text-accent">
                    Start <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </p>
                </ScenePlate>
              </Link>
            </li>
          ))}
        </ul>
        <div aria-hidden className="sprockets mt-3 h-3 w-full" />
      </section>
    </main>
  );
}
