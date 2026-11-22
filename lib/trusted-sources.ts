// Evidence domains the AI verification pipeline accepts (subdomains included). Add the official
// tourism sites of new film towns here when they are researched; changes are reviewed in git, never
// edited from the admin. Everything else goes to review.
export const TRUSTED_DOMAINS = [
  // Official tourism, city and cultural sites
  "visitberlin.de", "berlin.de", "reiseland-brandenburg.de", "brandenburg-tourism.com", "potsdam.de",
  "visit-goerlitz.com", "goerlitz.de", "germany.travel", "deutschland.de", "goethe.de",
  // State tourism boards
  "bayern.by", "tourismus-bw.de", "sachsen-tourismus.de", "thueringen-entdecken.de", "auf-nach-mv.de",
  "sh-tourismus.de", "reiseland-niedersachsen.de", "dein-nrw.de", "hessen-tourismus.de",
  // Cities and their official tourism sites
  "hamburg.de", "hamburg-travel.com", "muenchen.de", "stadt-koeln.de", "cologne-tourism.com",
  "frankfurt.de", "frankfurt-tourismus.de", "duesseldorf.de", "duesseldorf-tourismus.de",
  "stuttgart.de", "stuttgart-tourist.de", "leipzig.de", "leipzig.travel", "dresden.de",
  // Regional film funds and commissions (they publish where productions shot)
  "medienboard.de", "ffhsh.de", "fff-bayern.de", "filmstiftung.de", "mdm-online.de", "mfg.de", "hessenfilm.de", "nordmedia.de",
  // Industry body and established location guides
  "motionpictures.org", "movie-locations.com", "atlasofwonders.com", "lonelyplanet.com",
  // Major media
  "rbb24.de", "tagesspiegel.de", "berliner-zeitung.de", "spiegel.de", "zeit.de", "sueddeutsche.de", "faz.net", "welt.de",
  "tagesschau.de", "ndr.de", "wdr.de", "br.de", "mdr.de", "swr.de", "hr.de", "dw.com",
  "theguardian.com", "nytimes.com", "bbc.co.uk", "bbc.com", "variety.com", "hollywoodreporter.com",
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
