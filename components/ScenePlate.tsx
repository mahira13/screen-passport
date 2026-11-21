import type { ReactNode } from "react";

// Atmospheric "film plates": light and colour only, no stills or posters.
export const PLATES = [
  "radial-gradient(120% 90% at 78% 22%, rgba(229,184,63,.55), transparent 55%), linear-gradient(160deg, #713c48 0%, #2a1519 55%, #101012 100%)",
  "radial-gradient(90% 80% at 18% 85%, rgba(235,170,215,.45), transparent 60%), linear-gradient(200deg, #26262b 0%, #101012 100%)",
  "linear-gradient(180deg, transparent 0 62%, rgba(229,184,63,.7) 62.4%, transparent 63.5%), radial-gradient(80% 60% at 50% 62%, rgba(229,184,63,.35), transparent 70%), linear-gradient(180deg, #1b1b24 0%, #3a2228 70%, #101012 100%)",
  "radial-gradient(70% 70% at 30% 30%, rgba(113,60,72,.9), transparent 70%), radial-gradient(60% 60% at 80% 80%, rgba(229,184,63,.3), transparent 70%), #141416",
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
      <span aria-hidden className="absolute inset-x-0 top-0 z-[2] h-[7%] bg-night/90" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 z-[2] h-[7%] bg-night/90" />
      <div className="relative z-[3] flex h-full flex-col justify-end p-4 pb-[9%] sm:p-5 sm:pb-[9%]">{children}</div>
    </div>
  );
}
