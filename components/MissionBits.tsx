// Small game pieces shared by mission cards and pages.

/** One film reel: a filled one counts towards the difficulty. */
function Reel({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${on ? "text-accent" : "text-current opacity-25"}`} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={10 + 5 * Math.cos(((a - 90) * Math.PI) / 180)} cy={10 + 5 * Math.sin(((a - 90) * Math.PI) / 180)} r="2" fill="var(--color-paper)" />
      ))}
      <circle cx="10" cy="10" r="1.2" fill="var(--color-paper)" />
    </svg>
  );
}

export function Reels({ n, label }: { n: number; label: string }) {
  return (
    <span role="img" aria-label={`${label}: ${n} of 5 reels`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => <Reel key={i} on={i <= n} />)}
    </span>
  );
}

/** Progress as a strip of film: one frame per scene, gold once checked in. */
export function FrameProgress({ done, total }: { done: number; total: number }) {
  return (
    <div role="img" aria-label={`${done} of ${total} scenes stamped`} className="film-strip film-strip-sm rounded-[3px] px-1.5">
      <div className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-4 min-w-0 flex-1 rounded-[1px] transition-colors duration-300 ${i < done ? "bg-accent" : "bg-ink/20"}`} />
        ))}
      </div>
    </div>
  );
}
