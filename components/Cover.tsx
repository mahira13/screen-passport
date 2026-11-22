import { initials } from "@/lib/explore-map";
import type { Photo } from "@/lib/nearby";

type Props = {
  photo: Photo | null;
  label: string; // initials come from this when there is no photo
  className?: string; // aspect ratio and sizing
  priority?: boolean;
  credit?: boolean; // false when the credit is shown elsewhere
};

/**
 * A large Commons photo with a small credit in the corner, or a navy and gold card with the
 * title's initials. Never an empty box. The credit sits above any stretched card link.
 */
export function Cover({ photo, label, className = "aspect-[4/3]", priority = false, credit = true }: Props) {
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {photo ? (
        <>
          {photo.kind === "poster" && (
            // A poster is shown whole, on a blurred copy of itself.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async"
            className={`absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.03] ${photo.kind === "poster" ? "object-contain" : "object-cover"}`} />
          {credit && (
            <a href={photo.page} target="_blank" rel="noopener noreferrer" title={`Photo: ${photo.author}, ${photo.license}`}
              className="absolute bottom-0 right-0 z-20 max-w-[70%] truncate bg-black/45 px-2 py-1 text-[10px] leading-tight text-white/80 backdrop-blur-sm hover:text-white">
              {photo.kind === "poster" ? "Poster" : "Photo"}: {photo.author} · {photo.license}
            </a>
          )}
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center"
          style={{ background: "radial-gradient(90% 80% at 75% 20%, rgba(227,176,75,.22), transparent 60%), linear-gradient(160deg, #24355a 0%, #1d2b4a 55%, #121c33 100%)" }}>
          <span className="flex aspect-square w-[34%] max-w-36 items-center justify-center rounded-full border-2 border-accent/70 font-display text-[clamp(1.5rem,7vw,3rem)] tracking-wider text-accent">
            {initials(label)}
          </span>
        </div>
      )}
    </div>
  );
}
