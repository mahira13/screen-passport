/** "AI-verified" or "Team-verified": how this place was checked against its source. */
export function VerifiedBadge({ by, className = "" }: { by: "ai" | "team" | null; className?: string }) {
  if (!by) return null;
  return (
    <span className={`label inline-flex items-center gap-1 rounded-sm bg-paper/80 px-2 py-1 text-[10px] text-ink backdrop-blur-sm ${className}`}
      title={by === "ai" ? "Checked by our AI pipeline against the linked source" : "Checked by our team against the linked source"}>
      <span aria-hidden className="text-accent">✓</span> {by === "ai" ? "AI-verified" : "Team-verified"}
    </span>
  );
}
