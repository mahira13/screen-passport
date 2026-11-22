// The link every shared image carries back to the app. Pure.

export const shareUrl = (site: string, path: string) => `${site.replace(/\/+$/, "")}${path}`;

/** "https://www.screenpassport.app/p/abc/" -> "screenpassport.app/p/abc", printed on images. */
export const linkLabel = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

/** Shown next to every image share. Instagram feed posts can't hold links; stories can, as a sticker. */
export const INSTAGRAM_HINT = "Story: add a link sticker with your copied link.";
