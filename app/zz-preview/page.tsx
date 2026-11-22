import { PassportStamp } from "@/components/PassportStamp";
import { StampBook } from "@/components/StampBook";
import { getLiveData } from "@/lib/live-data";

export default async function P() {
  const d = await getLiveData();
  const ps = [...new Map(d.locations.map((l) => [l.id, l])).values()].slice(0, 9).map((l) => ({ id: l.id, name: l.name, city: l.city }));
  return (
    <main className="px-4 py-8">
      <StampBook passportId="PREVIEW12345" stamped={ps.slice(0, 4)} empty={ps.slice(4, 6)} />
      <div className="mt-10 passport-page relative mx-auto w-64 rounded-sm p-8">
        <PassportStamp name={ps[0].name} city={ps[0].city} date="2026-11-22" tilt={-8} drop />
        <p className="mt-5 text-center font-display text-lg font-bold">That&apos;s a take.</p>
      </div>
    </main>
  );
}
