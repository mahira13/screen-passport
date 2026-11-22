import type { CSSProperties } from "react";
import { CARD_HEIGHT, CARD_WIDTH, projectDots, type CardData } from "@/lib/share-card";
import { linkLabel } from "@/lib/share-link";
import { QrCode } from "./QrCode";

// The 1080×1920 story image. Plain inline styles in px so the export looks
// the same on every phone. No map tiles, posters or stills.
// Instagram covers about the top 250 px and bottom 250 px of a story with its
// own UI, so the wordmark and the link sit inside that safe area.
const NAVY = "#16213A";
const CREAM = "#F4EFE4";
const GOLD = "#E3B04B";
const DISPLAY = "var(--font-grotesk), var(--font-inter), system-ui, sans-serif";
const BODY = "var(--font-inter), system-ui, sans-serif";
const MAP_W = 936;
const MAP_H = 320;
const STAMP = 200;

const card: CSSProperties = {
  width: CARD_WIDTH, height: CARD_HEIGHT, background: NAVY, color: CREAM, fontFamily: BODY,
  padding: "190px 72px 240px", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden",
};

// Children never shrink: if something is too tall we want to see it, not lose a line.
const row: CSSProperties = { flexShrink: 0 };

const oneLine: CSSProperties = { ...row, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const stampBox = (border: string, background: string, color: string): CSSProperties => ({
  width: STAMP, height: STAMP, borderRadius: "50%", boxSizing: "border-box", padding: 22,
  border: `5px dashed ${border}`, background, color, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden",
});

export function ShareCardArt({ data, link }: { data: CardData; link: string }) {
  const dots = projectDots(data.dots, MAP_W, MAP_H, 40);
  return (
    <div style={card}>
      <div style={{ ...row, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>Screen Passport</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 28, color: GOLD, textTransform: "uppercase", letterSpacing: 4 }}>
          {data.cityName} edition
        </div>
      </div>
      {data.displayName && <div style={{ ...oneLine, fontSize: 36, marginTop: 12 }}>{data.displayName}</div>}

      <div style={{ ...row, marginTop: 32, display: "flex", alignItems: "baseline", gap: 24 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 160, fontWeight: 700, lineHeight: 0.9 }}>{data.placeCount}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 54, fontWeight: 600, lineHeight: 1.05 }}>
          filming<br />{data.placeCount === 1 ? "place" : "places"}
        </span>
      </div>
      <div style={{ ...row, fontSize: 34, marginTop: 14, opacity: 0.85 }}>from your films near {data.cityName}</div>

      <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        style={{ marginTop: 32, flexShrink: 0, borderRadius: 28, background: "rgba(244,239,228,0.06)", border: "2px solid rgba(244,239,228,0.18)" }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={13} fill={d.colour} stroke={NAVY} strokeWidth={4} />
        ))}
      </svg>

      <div style={{ ...row, display: "flex", flexWrap: "wrap", gap: 24, marginTop: 32, justifyContent: "center" }}>
        {data.stamps.map((s, i) => (
          <div key={i} style={s.visited ? stampBox(NAVY, GOLD, NAVY) : stampBox(s.colour, "transparent", CREAM)}>
            <div style={{ fontFamily: DISPLAY, fontSize: s.title.length > 18 ? 24 : 30, fontWeight: 700, lineHeight: 1.1 }}>{s.title}</div>
            <div style={{ fontSize: 22, marginTop: 8 }}>{s.places} {s.places === 1 ? "place" : "places"}</div>
          </div>
        ))}
        {data.moreStamps > 0 && (
          <div style={stampBox("rgba(244,239,228,0.5)", "transparent", CREAM)}>
            <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 700 }}>+{data.moreStamps}</div>
            <div style={{ fontSize: 22, marginTop: 4 }}>more</div>
          </div>
        )}
      </div>

      <div style={{ ...row, marginTop: "auto" }}>
        {data.closest && <div style={{ ...oneLine, fontSize: 30 }}>{data.closest}</div>}
        {data.collection && (
          <div style={{ ...oneLine, fontFamily: DISPLAY, fontSize: 34, color: GOLD, fontWeight: 600, marginTop: 10 }}>{data.collection}</div>
        )}
        <div style={{ borderTop: "2px solid rgba(244,239,228,0.25)", marginTop: 24, paddingTop: 24, display: "flex", alignItems: "center", gap: 32 }}>
          <QrCode text={link} size={150} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 32 }}>Scan or visit</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 700, color: GOLD, marginTop: 8, overflowWrap: "anywhere" }}>{linkLabel(link)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
