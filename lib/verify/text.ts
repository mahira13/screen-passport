// Turning a fetched page into plain text, and checking that a quoted sentence is really on it.

const NAMED: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", auml: "ä", ouml: "ö", uuml: "ü",
  Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", laquo: "«", raquo: "»",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] ?? m;
  });
}

/** Visible text of an HTML page: no scripts, styles or tags, entities decoded, whitespace collapsed. */
export function extractText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[–—‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const MAX_QUOTE_WORDS = 25;

/** The model's quote must be 3–25 words and appear on the page (ignoring case, spacing, quote styles). */
export function quoteFound(quote: string, pageText: string): boolean {
  const q = norm(quote).replace(/^["'.,;:…-]+|["'.,;:…-]+$/g, "").trim();
  const words = q.split(" ").filter(Boolean).length;
  if (words < 3 || words > MAX_QUOTE_WORDS) return false;
  return norm(pageText).includes(q);
}
