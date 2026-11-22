"use client";

import { useEffect } from "react";
import { PassportStamp } from "./PassportStamp";

// Fixed confetti directions so server and client agree (no Math.random in render).
const BITS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = 90 + (i % 3) * 30;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - 20, rot: (i % 2 ? 1 : -1) * (180 + i * 20), w: i % 3 ? 6 : 9 };
});

/** The check-in moment: a stamp falls onto a passport page with a thud and a burst of gold. */
export function StampDrop({ name, city, onDone }: { name: string; city: string | null; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  const today = new Date().toLocaleDateString("sv-SE");
  return (
    <div role="status" aria-live="polite" onClick={onDone}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-paper/70 backdrop-blur-sm">
      <span className="sr-only">Stamped: {name}</span>
      <div className="thud passport-page relative w-64 rounded-sm p-8 shadow-2xl shadow-black/60">
        <PassportStamp name={name} city={city} date={today} tilt={-8} drop />
        {BITS.map((b, i) => (
          <span key={i} aria-hidden className="confetti absolute left-1/2 top-1/2 h-2 rounded-[1px] bg-accent"
            style={{ width: b.w, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px`, ["--r" as string]: `${b.rot}deg` }} />
        ))}
        <p className="mt-5 text-center font-display text-lg font-bold">That&apos;s a take.</p>
      </div>
    </div>
  );
}
