// Scene postcard layout: the visitor's own photo in a letterbox frame with a bottom band. Pure.
export type PostcardFormat = "4:5" | "9:16";
export const POSTCARD_SIZE: Record<PostcardFormat, { w: number; h: number }> = { "4:5": { w: 1080, h: 1350 }, "9:16": { w: 1080, h: 1920 } };
export const CAPTION_MAX = 80;

export type Rect = { x: number; y: number; w: number; h: number };

/** Where the photo goes (between letterbox bars) and the band under it. */
export function postcardLayout(f: PostcardFormat): { photo: Rect; band: Rect } {
  const { w, h } = POSTCARD_SIZE[f];
  const band = f === "4:5" ? 330 : 420;
  const top = f === "4:5" ? 160 : 200; // black letterbox bars above the photo and before the band
  const photoH = h - band - top - (f === "4:5" ? top : 80);
  return { photo: { x: 0, y: top, w, h: photoH }, band: { x: 0, y: h - band, w, h: band } };
}

/** Source crop so the photo covers the window without stretching (centred). */
export function coverCrop(imgW: number, imgH: number, box: { w: number; h: number }): Rect {
  const scale = Math.max(box.w / imgW, box.h / imgH);
  const w = box.w / scale, h = box.h / scale;
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

/** The visitor's own caption: trimmed, one line, at most 80 characters. */
export const cleanCaption = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX);
