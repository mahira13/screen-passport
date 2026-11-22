import type { Photo } from "@/lib/nearby";

/**
 * Real place photos (Commons) on a slowly scrolling strip of film. Decorative: credits are on each
 * place's own page; here they sit in the frame's title attribute.
 */
export function FilmStrip({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;
  const frames = [...photos, ...photos]; // twice, so the -50% scroll loops without a jump
  return (
    <div aria-hidden className="film-strip overflow-hidden">
      <div className="film-strip-track gap-2">
        {frames.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={p.url} alt="" title={`Photo: ${p.author} · ${p.license}`} loading={i < 4 ? "eager" : "lazy"} decoding="async"
            className="h-28 w-40 shrink-0 rounded-[3px] object-cover sm:h-40 sm:w-60" />
        ))}
      </div>
    </div>
  );
}
