import type { ReactNode } from "react";

// Atmospheric "film plates": light and colour only, no stills or posters.
// Navy with gold light only, so every plate stays in the one-accent palette.
export const PLATES = [
  "radial-gradient(120% 90% at 78% 22%, rgba(227,176,75,.45), transparent 55%), linear-gradient(160deg, #2a3d66 0%, #1d2b4a 50%, #0f182b 100%)",
  "radial-gradient(90% 80% at 18% 85%, rgba(244,239,228,.16), transparent 60%), linear-gradient(200deg, #24355a 0%, #0f182b 100%)",
  "linear-gradient(180deg, transparent 0 62%, rgba(227,176,75,.7) 62.4%, transparent 63.5%), radial-gradient(80% 60% at 50% 62%, rgba(227,176,75,.3), transparent 70%), linear-gradient(180deg, #0f182b 0%, #24355a 70%, #0f182b 100%)",
  "radial-gradient(70% 70% at 30% 30%, rgba(42,61,102,.95), transparent 70%), radial-gradient(60% 60% at 80% 80%, rgba(227,176,75,.28), transparent 70%), #121c33",
] as const;

type Props = {
  index: number;
  className?: string;
  children?: ReactNode;
};

/** A letterboxed frame with grain. Content sits on top, bottom-left. */
export function ScenePlate({ index, className = "", children }: Props) {
  return (
    <div className={`grain relative overflow-hidden ${className}`} style={{ background: PLATES[index % PLATES.length] }}>
      <span aria-hidden className="absolute inset-x-0 top-0 z-[2] h-[7%] bg-[#0f182b]/90" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 z-[2] h-[7%] bg-[#0f182b]/90" />
      <div className="relative z-[3] flex h-full flex-col justify-end p-4 pb-[9%] sm:p-5 sm:pb-[9%]">{children}</div>
    </div>
  );
}
