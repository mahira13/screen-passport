// Product rule 3: no Wikipedia or fan wikis as sources.
const UNTRUSTED = /(^|\.)(wikipedia\.(org|com)|wikia\.com|fandom\.com)$/i;

export function isUntrustedSource(url: string): boolean {
  try {
    return UNTRUSTED.test(new URL(url).hostname);
  } catch {
    return true; // not a valid URL
  }
}
