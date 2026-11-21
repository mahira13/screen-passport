"use client";

import { toBlob } from "html-to-image";

/** Draws a DOM node to a PNG at its real size. */
export async function renderPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  await document.fonts.ready;
  const options = { width, height, pixelRatio: 1, cacheBust: true };
  await toBlob(node, options); // Safari often drops fonts on the first pass; the second is right.
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Could not draw the card");
  return blob;
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True where the Web Share API can share image files (most phones). */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob()], "probe.png", { type: "image/png" });
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled" | "tap_again" | "downloaded";

/** Web Share with the file; download when sharing files isn't possible or fails. */
export async function shareOrDownload(file: File, canShare: boolean, data: { title: string; text: string }): Promise<ShareOutcome> {
  if (canShare) {
    try {
      await navigator.share({ files: [file], ...data });
      return "shared";
    } catch (e) {
      const name = (e as Error).name;
      if (name === "AbortError") return "cancelled"; // closed the share sheet
      if (name === "NotAllowedError") return "tap_again"; // iOS: too long since the tap
    }
  }
  downloadFile(file);
  return "downloaded";
}
