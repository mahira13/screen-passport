import { qrMatrix, qrPath, QR_QUIET } from "@/lib/qr";

/** A QR code as inline SVG (dark modules on cream), for the HTML share images. */
export function QrCode({ text, size, dark = "#16213A", light = "#F4EFE4" }: { text: string; size: number; dark?: string; light?: string }) {
  const m = qrMatrix(text);
  const n = m.length + QR_QUIET * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ flexShrink: 0, display: "block" }}>
      <rect width={n} height={n} fill={light} />
      <path d={qrPath(m)} fill={dark} />
    </svg>
  );
}
