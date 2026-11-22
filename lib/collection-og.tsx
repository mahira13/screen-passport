import { ImageResponse } from "next/og";
import type { CollectionModel } from "./collections-model";

export const OG_SIZE = { width: 1200, height: 630 };

// Text only: no film stills, posters or logos.
export function collectionOgImage(c: CollectionModel | null): ImageResponse {
  const cities = c ? [...new Set(c.places.map((p) => p.city).filter(Boolean))] : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#16213A", color: "#F4EFE4", padding: 72 }}>
        <div style={{ fontSize: 30, color: "#E3B04B", letterSpacing: 4 }}>SCREEN PASSPORT · COLLECTION</div>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05 }}>{c?.name ?? "Filming places collection"}</div>
        <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>
          {c ? `${c.places.length} sourced places · ${cities.slice(0, 3).join(" · ")}` : "Real places, each with a source"}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
