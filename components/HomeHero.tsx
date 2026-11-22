"use client";

import type { ReactNode } from "react";
import { formatDistance } from "@/lib/distance";
import type { NearbyTitle } from "@/lib/nearby";
import { ScenePlate } from "./ScenePlate";

type Props = {
  cityLabel: string;
  titles: NearbyTitle[]; // closest first
  placeCount: number;
  onPick: (workId: string) => void;
  search: ReactNode;
};

function Plate({ t, n, className, big = false, onPick }: { t: NearbyTitle; n: number; className: string; big?: boolean; onPick: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(t.workId)} aria-label={`Show ${t.title} on the map`}
      className={`group block text-left transition-transform duration-500 hover:-translate-y-1 ${className}`}>
      <ScenePlate index={n} className="aspect-[2.39/1] w-full shadow-2xl shadow-black/60">
        <p className={`label text-ink/70 ${big ? "" : "hidden sm:block"}`}>Scene {String(n + 1).padStart(2, "0")} · {formatDistance(t.closest.distanceKm)}</p>
        <p className={`mt-1 font-condensed leading-[0.9] tracking-wide text-ink ${big ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>
          {t.closest.name}
        </p>
        <p className={`font-serif italic text-accent ${big ? "text-xl sm:text-2xl" : "text-lg"}`}>{t.title}</p>
      </ScenePlate>
    </button>
  );
}

export function HomeHero({ cityLabel, titles, placeCount, onPick, search }: Props) {
  const plates = titles.slice(0, 3);
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative mx-auto grid w-full max-w-screen-2xl gap-12 px-4 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-12 lg:pb-24">
        <div className="flex flex-col">
          <p className="label flex flex-wrap items-center gap-x-3 gap-y-1 text-ink/60">
            <span className="text-accent">Vol. 01</span>
            <span aria-hidden className="h-px w-8 bg-ink/30" />
            <span>{cityLabel} edition</span>
            {placeCount > 0 && (<><span aria-hidden className="h-px w-8 bg-ink/30" /><span>{placeCount} sourced places</span></>)}
          </p>
          <h1 className="mt-6 font-serif text-[3.2rem] leading-[0.92] tracking-tight sm:text-7xl xl:text-[6.5rem]">
            Your favourite stories don&apos;t have to <span className="italic text-accent">stay on screen.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/75">
            Screen Passport shows where films and series were really shot near you. Mark what you&apos;ve watched,
            go and find the places, stamp them, and turn them into a trip with friends.
          </p>
          <div id="search" className="mt-8 max-w-xl scroll-mt-24">{search}</div>
        </div>

        {plates.length > 0 && (
          <div className="relative lg:pt-6">
            <div aria-hidden className="sprockets mb-3 h-3 w-full" />
            <div className="grid grid-cols-6 gap-3">
              <Plate t={plates[0]} n={0} big className="col-span-6" onPick={onPick} />
              {plates[1] && <Plate t={plates[1]} n={1} className="col-span-3 lg:-ml-10" onPick={onPick} />}
              {plates[2] && <Plate t={plates[2]} n={2} className="col-span-3 mt-6 sm:mt-10" onPick={onPick} />}
            </div>
            <div aria-hidden className="sprockets mt-3 h-3 w-full" />
            <p className="label mt-4 text-right text-ink/60">Closest filming places to {cityLabel} · tap to see on the map</p>
          </div>
        )}
      </div>
    </section>
  );
}
