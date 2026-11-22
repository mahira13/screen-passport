import Link from "next/link";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/nearby";
import { Cover } from "./Cover";

type Props = {
  href: string;
  title: string;
  photo: Photo | null;
  meta?: ReactNode; // at most two short lines under the title
  eyebrow?: string; // tiny label over the photo, e.g. "Series"
  badge?: ReactNode; // top-right corner, e.g. a stamp
  aspect?: string;
  big?: boolean;
  priority?: boolean;
  overlay?: boolean; // the title sits on the photo, over a dark gradient
  children?: ReactNode; // actions below, above the stretched link
};

/** Photo first, then a big title and up to two short lines. The whole card is one link. */
export function PhotoCard({ href, title, photo, meta, eyebrow, badge, aspect = "aspect-[4/3]", big = false, priority, overlay = false, children }: Props) {
  const size = big ? "text-3xl sm:text-4xl" : "text-2xl";
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <Cover photo={photo} label={title} className={`${aspect} rounded-sm`} priority={priority} />
        {eyebrow && <span className="label absolute left-3 top-3 z-10 bg-paper/80 px-2 py-1 text-ink backdrop-blur-sm">{eyebrow}</span>}
        {badge && <div className="absolute right-3 top-3 z-10">{badge}</div>}
        {overlay && (
          // Room at the bottom for the photo credit, which stays clickable above the link.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-sm bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-7 pt-20">
            <h3 className={`font-display leading-[1.02] tracking-tight text-ink drop-shadow ${big ? "text-4xl sm:text-5xl" : "text-3xl"}`}>{title}</h3>
          </div>
        )}
      </div>
      {overlay ? (
        <Link href={href} aria-label={title} className="absolute inset-0 z-0 rounded-sm focus-visible:outline-2 focus-visible:outline-accent" />
      ) : (
        <h3 className={`mt-3 font-display leading-[1.05] tracking-tight text-ink transition-colors group-hover:text-accent ${size}`}>
          <Link href={href} className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent">{title}</Link>
        </h3>
      )}
      {meta && <div className={`${overlay ? "mt-2" : "mt-1"} text-sm text-ink/65`}>{meta}</div>}
      {children && <div className="relative z-10 mt-3">{children}</div>}
    </article>
  );
}
