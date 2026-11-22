/** A circular progress ring: done of total, gold on a faint track. Plain SVG, no client code. */
export function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} of ${total}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3B04B" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${c * share} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="currentColor" style={{ font: `400 ${size / 3.2}px var(--font-bebas), sans-serif` }}>
        {done}/{total}
      </text>
    </svg>
  );
}
