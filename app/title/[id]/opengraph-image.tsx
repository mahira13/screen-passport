import { ImageResponse } from "next/og";
import { loadTitle } from "@/lib/catalogue-loaders";

export const alt = "Where this title was filmed, on Screen Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Text only: no film stills, posters or logos.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const t = await loadTitle((await params).id).catch(() => null);
  const cities = t ? [...new Set(t.places.map((p) => p.city).filter(Boolean))] : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#16213A", color: "#F4EFE4", padding: 72 }}>
        <div style={{ fontSize: 30, color: "#E3B04B", letterSpacing: 4 }}>SCREEN PASSPORT · FILMING LOCATIONS</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#E3B04B" }}>Where it was filmed</div>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>{t?.work.title ?? "Filming locations"}</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>
          {t ? `${t.places.length} sourced ${t.places.length === 1 ? "place" : "places"} · ${cities.slice(0, 3).join(" · ")}` : "Real places, each with a source"}
        </div>
      </div>
    ),
    size,
  );
}
