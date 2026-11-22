type Props = {
  name: string;
  city?: string | null;
  date?: string | null; // YYYY-MM-DD, only known on the device that checked in
  tilt?: number;
  drop?: boolean; // play the stamp-drop animation
  empty?: boolean; // a faint outline for a scene still to visit
};

const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

/** A round gold rubber stamp for one checked-in place, or the faint outline of an empty slot. */
export function PassportStamp({ name, city, date, tilt = -6, drop = false, empty = false }: Props) {
  if (empty) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-full border-2 border-dashed border-paper/15 p-4 text-center">
        <span className="line-clamp-2 text-[11px] leading-tight text-paper/35">{name}</span>
      </div>
    );
  }
  // Sizes in container units, so a 100 px stamp and a 250 px stamp look the same.
  return (
    <div style={{ ["--tilt" as string]: `${tilt}deg`, transform: `rotate(${tilt}deg)` }} className={`@container ${drop ? "stamp-drop" : ""}`}>
      <div className="ink relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-full border-[3cqw] border-[#a8741d] px-[14cqw] text-center text-[#a8741d]">
        <span aria-hidden className="absolute inset-[5cqw] rounded-full border-[1.2cqw] border-current" />
        <span className="text-[7cqw] font-semibold leading-none tracking-[0.15em]">★ FILMED HERE ★</span>
        <span className="mt-[3cqw] line-clamp-2 break-words font-display text-[10cqw] font-bold uppercase leading-[1.02] tracking-tight [hyphens:auto]">{name}</span>
        {city && <span className="mt-[2cqw] text-[7cqw] font-semibold uppercase leading-none tracking-[0.15em]">{city}</span>}
        <span className="mt-[3cqw] border-y-[0.8cqw] border-current px-[2cqw] py-[0.5cqw] font-mono text-[7cqw] leading-none tracking-wider">{date ? short(date) : "CHECKED IN"}</span>
      </div>
    </div>
  );
}
