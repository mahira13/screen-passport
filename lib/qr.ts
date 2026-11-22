// QR codes for share images, drawn by us (SVG path or canvas) so they render offline. Pure.
import QRCode from "qrcode";

export const QR_QUIET = 4; // modules of white border scanners need

/** Dark (true) / light modules, row by row. Error correction M survives a little compression. */
export function qrMatrix(text: string): boolean[][] {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => data[r * size + c] === 1));
}

/** SVG path of the dark modules, in module units, shifted by the quiet zone. */
export function qrPath(m: boolean[][], quiet = QR_QUIET): string {
  let d = "";
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
  return d;
}
