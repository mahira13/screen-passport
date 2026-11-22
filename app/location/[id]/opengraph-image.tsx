import { ImageResponse } from "next/og";
import { loadLocation } from "@/lib/catalogue-loaders";

export const alt = "A filming location on Screen Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Text only: no film stills, posters or logos (and no third-party photo in the share image).
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const l = await loadLocation((await params).id).catch(() => null);
  const where = l ? [l.place.city, l.country].filter(Boolean).join(", ") : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#16213A", color: "#F4EFE4", padding: 72 }}>
        <div style={{ fontSize: 30, color: "#E3B04B", letterSpacing: 4 }}>SCREEN PASSPORT · FILMED HERE</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>{l?.place.name ?? "A filming location"}</div>
          {where && <div style={{ fontSize: 40, marginTop: 16, opacity: 0.85 }}>{where}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#E3B04B" }}>
          {l ? l.titles.slice(0, 3).map((t) => t.title).join(" · ") : "Real places, each with a source"}
        </div>
      </div>
    ),
    size,
  );
}
