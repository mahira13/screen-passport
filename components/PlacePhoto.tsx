import type { Photo } from "@/lib/nearby";

/** "Photo: <author>, <licence>", linked to the Commons file page (product rule 6). */
export function PhotoCredit({ photo, className = "" }: { photo: Photo; className?: string }) {
  return (
    <a href={photo.page} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center text-[11px] leading-tight text-ink/70 underline-offset-2 hover:text-accent hover:underline ${className}`}>
      Photo: {photo.author}, {photo.license}
    </a>
  );
}

/** The place's Commons photo with its credit; nothing when it has no shown photo. */
export function PlacePhoto({ photo, name, className = "" }: { photo: Photo | null; name: string; className?: string }) {
  if (!photo) return null;
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={`Photo of ${name}`} loading="lazy" decoding="async" className="aspect-[16/9] w-full bg-surface object-cover" />
      <figcaption><PhotoCredit photo={photo} /></figcaption>
    </figure>
  );
}
