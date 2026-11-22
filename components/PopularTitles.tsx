"use client";

import type { PopularTitle } from "@/lib/discover";

/** Most-collected titles: how many passports marked them watched (real counts only). */
export function PopularTitles({ titles, onPick }: { titles: PopularTitle[]; onPick: (workId: string) => void }) {
  return (
    <section aria-labelledby="popular-h" className="border-t border-ink/10 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12">
        <p className="label text-accent">03 — Popular titles</p>
        <h2 id="popular-h" className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          Most <span className="italic text-accent">collected.</span>
        </h2>
        <p className="mt-4 max-w-lg text-ink/70">Ranked by how many passports marked them watched, then by how many places they have.</p>
        <ol className="mt-10 grid gap-x-10 border-t border-ink/20 sm:grid-cols-2">
          {titles.map((t, i) => (
            <li key={t.workId} className="border-b border-ink/15">
              <button type="button" onClick={() => onPick(t.workId)} aria-label={`Show ${t.title} on the map`}
                className="group flex w-full items-baseline gap-4 py-4 text-left">
                <span className="font-condensed text-3xl leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-2xl leading-tight transition-colors group-hover:text-accent sm:text-3xl">{t.title}</span>
                  <span className="label mt-1 block text-ink/60">
                    {t.type} · {t.places} {t.places === 1 ? "place" : "places"}
                    {t.passports > 0 && ` · in ${t.passports} ${t.passports === 1 ? "passport" : "passports"}`}
                  </span>
                </span>
                <span aria-hidden className="label text-ink/50 transition-colors group-hover:text-accent">Map →</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
