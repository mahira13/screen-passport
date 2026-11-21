// Basic launch safety for text people can see on trip pages. Not a full filter:
// it stops links and the obvious slurs and swear words (English and German).

const URL_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\s*(\.|\(dot\)|\[dot\])\s*(com|de|net|org|io|ly|me|co|app|xyz|info|ru|tk|gg|link|site|online|shop|eu|uk|at|ch)\b)/i;

// Whole words only, so names like "Dick" or places like "Scunthorpe" pass.
const WORDS = new Set([
  "fuck", "fucking", "fucker", "shit", "cunt", "bitch", "whore", "slut", "rape", "rapist", "nazi", "nazis",
  "faggot", "fag", "retard", "retarded", "nigger", "nigga", "kike", "spic", "chink", "twat", "wanker", "asshole",
  "pussy", "porn", "sex", "cum", "scheisse", "scheiss", "fotze", "hure", "huren", "hurensohn", "wichser", "arschloch",
  "schlampe", "missgeburt", "spast", "schwuchtel", "neger", "kanake", "ficken", "fick", "nutte", "hitler", "heil",
]);
// Also caught inside longer words (German compounds, "fuckface").
const STEMS = ["fuck", "nigger", "nigga", "faggot", "fotze", "hurensohn", "wichser", "hitler", "scheiss"];

/** Lowercase, no accents, common letter swaps undone (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s). */
export function normaliseForCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0134@5$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s" })[c]!);
}

export function containsUrl(text: string): boolean {
  return URL_PATTERN.test(text);
}

export function containsOffensive(text: string): boolean {
  const norm = normaliseForCheck(text);
  if (norm.split(/[^a-z]+/).some((w) => WORDS.has(w))) return true;
  const squashed = norm.replace(/[^a-z]/g, "");
  return STEMS.some((s) => squashed.includes(s));
}

/** True if the text is fine to show on a public trip page. */
export function isCleanText(text: string): boolean {
  return !containsUrl(text) && !containsOffensive(text);
}
