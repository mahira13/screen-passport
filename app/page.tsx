import Link from "next/link";
import { FilmStrip } from "@/components/FilmStrip";
import { HomeSearch } from "@/components/HomeSearch";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { homeData } from "@/lib/page-data";

export default async function Home() {
  const { strip, examples } = await homeData();
  return (
    <main className="w-full overflow-hidden pb-20">
      <LegacyHashRedirect />
      <section className="mx-auto w-full max-w-screen-xl px-4 pt-10 sm:px-8 sm:pt-16">
        <h1 className="font-display text-[clamp(3rem,13vw,7.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.03em]">
          From the screen <span className="block text-accent">to the streets.</span>
        </h1>
        <p className="mt-5 text-lg text-ink/80 sm:text-xl">Find where it was filmed. Go there. Get the stamp.</p>
      </section>

      <div className="mt-8 -rotate-2 scale-105 sm:mt-10"><FilmStrip photos={strip} /></div>

      <section className="mx-auto w-full max-w-screen-xl px-4 pt-10 sm:px-8">
        <Link href="/discover?near=1"
          className="lift flex min-h-16 w-full items-center justify-center gap-3 rounded-sm bg-accent px-8 font-display text-2xl font-bold text-paper sm:inline-flex sm:w-auto">
          Start near me <span aria-hidden>▸</span>
        </Link>
        <p className="label mt-3 text-ink/60">Free · no sign-up</p>
        <div id="search" className="mt-10 max-w-2xl scroll-mt-24"><HomeSearch examples={examples} /></div>
      </section>
    </main>
  );
}
