// Product rule 3: no Wikipedia or fan wikis as sources. Wikidata finds candidates but is
// never the only evidence for a published place (it often cites nothing).
const UNTRUSTED = /(^|\.)(wikipedia\.(org|com)|wikidata\.org|wikia\.com|fandom\.com)$/i;

export function isUntrustedSource(url: string): boolean {
  try {
    return UNTRUSTED.test(new URL(url).hostname);
  } catch {
    return true; // not a valid URL
  }
}
