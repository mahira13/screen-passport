"use client";

import { usePassport } from "@/lib/use-passport";
import { PassportStamp } from "./PassportStamp";

type Place = { id: number; name: string; city: string | null };
const TILT = [-7, 5, -3, 8, -5, 3, -9, 6];

/**
 * Passport pages: a gold stamp per checked-in place, then faint outlines for scenes still to visit.
 * Dates live only in this browser, so they show to the holder and not on someone else's phone.
 */
export function StampBook({ passportId, stamped, empty }: { passportId: string; stamped: Place[]; empty: Place[] }) {
  const { id, stampedAt } = usePassport();
  const dates = id === passportId ? stampedAt : {};
  return (
    <div className="passport-page rounded-sm px-4 pb-8 pt-6 shadow-2xl shadow-black/50 sm:px-8">
      <div className="flex items-baseline justify-between border-b border-paper/15 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-paper/60">Stamps · Visas</p>
        <p className="font-mono text-[10px] tracking-widest text-paper/50">No. {passportId}</p>
      </div>
      {stamped.length === 0 && (
        <p className="mt-5 font-display text-xl font-bold text-paper/80">No stamps yet. Your first set is closer than you think.</p>
      )}
      <ul className="mt-6 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
        {stamped.map((p, i) => (
          <li key={p.id}><PassportStamp name={p.name} city={p.city} date={dates[p.id]} tilt={TILT[i % TILT.length]} /></li>
        ))}
        {empty.map((p) => <li key={p.id}><PassportStamp name={p.name} empty /></li>)}
      </ul>
    </div>
  );
}
