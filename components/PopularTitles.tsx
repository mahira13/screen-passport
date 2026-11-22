"use client";

import type { PopularTitle } from "@/lib/discover";
import { InfoTip } from "./InfoTip";

/** Most-collected titles: how many passports marked them watched (real counts only). */
export function PopularTitles({ titles, onPick }: { titles: PopularTitle[]; onPick: (workId: string) => void }) {
  return (
    <section aria-labelledby="popular-h" className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-1">
          <h2 id="popular-h" className="font-display text-4xl tracking-tight sm:text-6xl">Most collected</h2>
          <InfoTip label="How this is ranked">By how many passports marked them watched, then by how many places they have.</InfoTip>
        </div>
        <ol className="mt-6 grid gap-x-10 sm:grid-cols-2">
          {titles.map((t, i) => (
            <li key={t.workId} className="border-b border-ink/10">
              <button type="button" onClick={() => onPick(t.workId)} aria-label={`Show ${t.title} on the map`}
                className="group flex w-full items-baseline gap-4 py-4 text-left">
                <span className="font-display text-3xl leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-2xl leading-tight transition-colors group-hover:text-accent sm:text-3xl">{t.title}</span>
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
