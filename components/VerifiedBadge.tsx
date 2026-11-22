/** "AI-verified" or "Team-verified": how this place was checked against its source. */
export function VerifiedBadge({ by }: { by: "ai" | "team" | null }) {
  if (!by) return null;
  return (
    <span className="label inline-flex min-h-11 items-center gap-1.5 px-1 text-ink/70"
      title={by === "ai" ? "Checked by our AI pipeline against the linked source" : "Checked by our team against the linked source"}>
      <span aria-hidden className="text-accent">✓</span> {by === "ai" ? "AI-verified" : "Team-verified"}
    </span>
  );
}
