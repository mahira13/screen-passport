"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { cleanCaption, coverCrop, CAPTION_MAX, POSTCARD_SIZE, postcardLayout, type PostcardFormat } from "@/lib/postcard";
import { canShareFiles, shareOrDownload } from "@/lib/share-image";

const NAVY = "#16213A", CREAM = "#F4EFE4", GOLD = "#E3B04B";

function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, f: PostcardFormat, t: { title: string; place: string; caption: string; link: string }) {
  const { w, h } = POSTCARD_SIZE[f];
  const { photo, band } = postcardLayout(f);
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  // The page's own fonts (next/font sets these variables on <html>); canvas can't read var() itself.
  const css = getComputedStyle(document.documentElement);
  const DISPLAY = `${css.getPropertyValue("--font-grotesk").trim() || "system-ui"}, sans-serif`;
  const BODY = `${css.getPropertyValue("--font-inter").trim() || "system-ui"}, sans-serif`;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h); // letterbox bars
  const c = coverCrop(img.naturalWidth, img.naturalHeight, photo);
  g.drawImage(img, c.x, c.y, c.w, c.h, photo.x, photo.y, photo.w, photo.h);
  if (t.caption) {
    g.font = `500 44px ${DISPLAY}`;
    g.fillStyle = CREAM;
    g.textAlign = "center";
    g.fillText(t.caption, w / 2, photo.y - 50, w - 120); // subtitle line in the top bar
  }
  g.fillStyle = NAVY;
  g.fillRect(band.x, band.y, band.w, band.h);
  g.textAlign = "left";
  g.fillStyle = GOLD;
  g.font = `600 30px ${BODY}`;
  g.fillText("FILMED HERE", 64, band.y + 70);
  g.fillStyle = CREAM;
  g.font = `700 64px ${DISPLAY}`;
  g.fillText(t.title, 64, band.y + 150, w - 128);
  g.font = `40px ${BODY}`;
  g.fillText(t.place, 64, band.y + 210, w - 128);
  g.fillStyle = GOLD;
  g.font = `600 28px ${BODY}`;
  g.fillText(`SCREEN PASSPORT · ${t.link}`, 64, band.y + band.h - 50, w - 128);
}

/**
 * The scene postcard: the visitor's own photo in a letterbox frame with the title and place.
 * Composed on a canvas in the browser; the photo is never uploaded.
 */
export function PostcardMaker({ placeId, place, title }: { placeId: number; place: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<PostcardFormat>("4:5");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (img && canvas.current) draw(canvas.current, img, format, { title, place, caption: cleanCaption(caption), link: window.location.host });
  }, [img, format, caption, title, place]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { setImg(i); setNote(null); };
    i.onerror = () => setNote("That file couldn't be opened as a photo. Try another one.");
    i.src = url;
  };

  const share = () => canvas.current?.toBlob(async (blob) => {
    if (!blob) return setNote("Couldn't make the image. Try again.");
    const file = new File([blob], `postcard-${placeId}.png`, { type: "image/png" });
    track("postcard_made", { location: placeId, format }); // no image data
    const r = await shareOrDownload(file, canShareFiles(), { title: `${title} · ${place}`, text: `Filmed here: ${place}. Find yours: ${window.location.origin}` });
    setNote(r === "downloaded" ? "Saved to your downloads." : r === "tap_again" ? "Tap Share again." : null);
  }, "image/png");

  return (
    <section className="mt-6 border-t-2 border-accent bg-surface p-5">
      <h2 className="font-display text-3xl">Make a scene postcard</h2>
      <p className="mt-1 text-sm text-ink/75">Your own photo, framed with the title and place. It stays on your phone unless you share it.</p>
      <label className="label mt-4 inline-flex min-h-11 cursor-pointer items-center bg-accent px-5 text-paper">
        {img ? "Choose another photo" : "Take or choose a photo"}
        <input type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" />
      </label>
      {img && (
        <div className="mt-4 grid gap-3">
          <div className="flex gap-2" role="group" aria-label="Format">
            {(["4:5", "9:16"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f}
                className={`label min-h-11 border px-4 ${format === f ? "border-accent bg-accent text-paper" : "border-ink/30 text-ink/80"}`}>
                {f === "4:5" ? "Post 4:5" : "Story 9:16"}
              </button>
            ))}
          </div>
          <label className="label text-ink/60">Your caption (optional)
            <input value={caption} maxLength={CAPTION_MAX} onChange={(e) => setCaption(e.target.value)}
              className="mt-1 block w-full border-b-2 border-ink/30 bg-transparent py-2 text-base normal-case tracking-normal text-ink focus:border-accent focus:outline-none" />
          </label>
          <canvas ref={canvas} className="w-full max-w-sm border border-ink/15" aria-label={`Postcard preview: ${title}, ${place}`} />
          <button type="button" onClick={share} className="label inline-flex min-h-11 w-fit items-center bg-accent px-5 text-paper">Share postcard ↗</button>
        </div>
      )}
      {note && <p role="status" className="mt-2 text-sm text-ink/80">{note}</p>}
    </section>
  );
}

