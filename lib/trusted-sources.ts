// Evidence domains the AI verification pipeline accepts (subdomains included). Add the official
// tourism sites of new film towns here when they are researched. Everything else goes to review.
export const TRUSTED_DOMAINS = [
  // Official tourism, city and cultural sites
  "visitberlin.de", "berlin.de", "reiseland-brandenburg.de", "brandenburg-tourism.com", "potsdam.de",
  "visit-goerlitz.com", "goerlitz.de", "germany.travel", "deutschland.de", "goethe.de", "medienboard.de",
  // Industry body and established location guides
  "motionpictures.org", "movie-locations.com", "atlasofwonders.com", "lonelyplanet.com",
  // Major media
  "rbb24.de", "tagesspiegel.de", "berliner-zeitung.de", "spiegel.de", "zeit.de", "theguardian.com", "nytimes.com",
] as const;

/** True for http(s) URLs on a trusted domain or one of its subdomains. */
export function isTrustedSource(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    host = u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return false;
  }
  return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}
