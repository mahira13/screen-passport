"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./PlacesMap";

const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

export function PlacesMapBox({ pins, className = "" }: { pins: MapPin[]; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <PlacesMap pins={pins} />
      <span aria-hidden className="pointer-events-none absolute left-3 top-3 z-[500] h-6 w-6 border-l-2 border-t-2 border-accent" />
      <span aria-hidden className="pointer-events-none absolute bottom-6 right-3 z-[500] h-6 w-6 border-b-2 border-r-2 border-accent" />
    </div>
  );
}
