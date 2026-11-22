// Wikimedia Commons photos for locations (product rule 6: Commons only, always credited).
// Pure helpers here; network calls in lib/images/run.ts.

export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
export const THUMB_WIDTH = 800;
const UPLOAD = /^https:\/\/upload\.wikimedia\.org\//;
/** The API now returns thumbnails on thumb.wikimedia.org; the same path works on upload.wikimedia.org, the host the database and map accept. */
const uploadHost = (url: string) => url.replace(/^https:\/\/thumb\.wikimedia\.org\//, "https://upload.wikimedia.org/");

export type ImageInfo = {
  url: string;
  thumburl?: string;
  descriptionurl: string;
  mime?: string;
  extmetadata?: Record<string, { value: string } | undefined>;
};
export type CommonsPage = { title: string; imageinfo?: ImageInfo[] };

export type Candidate = {
  file: string; // "File:…"
  url: string;
  thumbUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourcePage: string;
  description: string;
};

const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** CC0, public domain, CC BY and CC BY-SA only (no NC/ND, no fair use). */
export function isFreeLicense(shortName: string): boolean {
  const s = shortName.toLowerCase().replace(/\s+/g, " ").trim();
  if (/\b(nc|nd)\b|non-?commercial|no ?deriv|fair use/.test(s)) return false;
  return /^(cc0|cc-zero|public domain|pd\b|pd-)/.test(s) || /^cc[ -]by(-sa)?[ -]\d/.test(s) || /^cc[ -]by(-sa)?$/.test(s);
}

// Film stills, screenshots, posters and portraits are out (product rule 6; no person as subject).
const EXCLUDED = /screenshot|screen ?shot|screencap|film still|movie still|filmstill|still from|poster|plakat|logo|trailer|promo(tional)?\b|key art|cover art|dvd|blu-?ray|portrait|porträt|selfie|headshot|\bcosplay\b/i;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

/** A usable candidate from a Commons page, or the reason it isn't one. */
export function toCandidate(page: CommonsPage): Candidate | { skip: string } {
  const info = page.imageinfo?.[0];
  if (!info) return { skip: "no image info" };
  if (info.mime && !IMAGE_MIME.test(info.mime)) return { skip: `not a photo (${info.mime})` };
  const m = info.extmetadata ?? {};
  const license = stripHtml(m.LicenseShortName?.value ?? "");
  if (!license || !isFreeLicense(license)) return { skip: `licence not free: ${license || "unknown"}` };
  const description = stripHtml(m.ImageDescription?.value ?? "").slice(0, 400);
  const categories = stripHtml(m.Categories?.value ?? "");
  if (EXCLUDED.test(`${page.title} ${description} ${categories}`)) return { skip: "still, poster, logo or portrait" };
  const author = stripHtml(m.Artist?.value ?? m.Credit?.value ?? "").slice(0, 200) || "Unknown author";
  const licenseUrl = m.LicenseUrl?.value && /^https?:\/\//.test(m.LicenseUrl.value) ? m.LicenseUrl.value : null;
  if (!UPLOAD.test(info.url)) return { skip: "not hosted on Commons" };
  return {
    file: page.title,
    url: info.url,
    thumbUrl: info.thumburl && UPLOAD.test(uploadHost(info.thumburl)) ? uploadHost(info.thumburl) : info.url,
    author,
    license: license.slice(0, 60),
    licenseUrl,
    sourcePage: info.descriptionurl,
    description,
  };
}

/** Query params for the three searches, in order of preference. All return imageinfo for files. */
const INFO = { prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: String(THUMB_WIDTH), iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|Categories" };
const BASE = { action: "query", format: "json", formatversion: "2", maxlag: "5", ...INFO };

export const byTitles = (files: string[]) => ({ ...BASE, titles: files.join("|") });
export const bySearch = (name: string, city: string | null) => ({
  ...BASE, generator: "search", gsrnamespace: "6", gsrlimit: "8", gsrsearch: [name, city].filter(Boolean).join(" ") + " filetype:bitmap",
});
export const byGeo = (lat: number, lng: number) => ({
  ...BASE, generator: "geosearch", ggsnamespace: "6", ggsradius: "100", ggslimit: "8", ggscoord: `${lat}|${lng}`,
});

/** Commons file name from a Wikidata P18 value ("Foo.jpg" → "File:Foo.jpg"). */
export const p18File = (value: string) => (value.startsWith("File:") ? value : `File:${value}`);

/** "https://commons.wikimedia.org/wiki/File:Foo_bar.jpg" → "File:Foo bar.jpg" (the API's title form, as stored in image_skip). */
export function fileFromPage(url: string | null | undefined): string | null {
  const m = url?.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return null;
  }
}
