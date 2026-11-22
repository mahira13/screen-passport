import type { CSSProperties } from "react";
import { INVITE_HEIGHT, INVITE_WIDTH, type InviteData } from "@/lib/invite-card";
import { QrCode } from "./QrCode";

// The 1080×1920 "Now showing" story image: a cinema ticket in our own colours.
// Plain inline styles in px so the export looks the same on every phone.
// No posters, stills, show logos, show fonts or script quotes: titles are plain text.
// Instagram covers about the top and bottom 250 px, so text stays between them.
const NAVY = "#16213A";
const CREAM = "#F4EFE4";
const GOLD = "#E3B04B";
const DISPLAY = "var(--font-grotesk), var(--font-inter), system-ui, sans-serif";
const BODY = "var(--font-inter), system-ui, sans-serif";
const PAD = 72;
const NOTCH = 44;

const card: CSSProperties = {
  position: "relative", width: INVITE_WIDTH, height: INVITE_HEIGHT, background: NAVY, color: CREAM, fontFamily: BODY,
  boxSizing: "border-box", padding: `250px ${PAD}px 250px`, display: "flex", flexDirection: "column", overflow: "hidden",
};

// Long text stops after n lines with "…".
const clamp = (lines: number, size: number, lineHeight: number): CSSProperties => ({
  fontSize: size, lineHeight, maxHeight: size * lineHeight * lines, overflow: "hidden", overflowWrap: "anywhere", flexShrink: 0,
  display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical",
});

/** Long trip titles get a smaller size so more of them fits in three lines. */
const titleSize = (title: string) => (title.length <= 28 ? 112 : title.length <= 50 ? 96 : 80);

const label: CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", color: GOLD };

/** A row of marquee bulbs. */
function Bulbs({ top }: { top: number }) {
  return (
    <div style={{ position: "absolute", left: PAD, right: PAD, top, display: "flex", justifyContent: "space-between" }}>
      {Array.from({ length: 15 }, (_, i) => (
        <span key={i} style={{ width: 18, height: 18, borderRadius: 9, background: GOLD, opacity: i % 2 ? 0.45 : 1 }} />
      ))}
    </div>
  );
}

/** The ticket's tear-off line: a half-circle bite at each edge and a dashed perforation. */
function Perforation() {
  const inset = 36; // perforation starts this far inside the ticket's border
  const bite = (side: "left" | "right"): CSSProperties => ({
    position: "absolute", top: 2 - NOTCH / 2, [side]: -inset - 4, width: NOTCH / 2, height: NOTCH, background: NAVY,
    boxSizing: "border-box", border: `4px solid ${GOLD}`,
    ...(side === "left"
      ? { borderLeft: "none", borderRadius: `0 ${NOTCH / 2}px ${NOTCH / 2}px 0` }
      : { borderRight: "none", borderRadius: `${NOTCH / 2}px 0 0 ${NOTCH / 2}px` }),
  });
  return (
    <div style={{ position: "relative", height: 0, borderTop: `4px dashed ${GOLD}`, margin: `0 ${inset}px`, flexShrink: 0 }}>
      <span style={bite("left")} />
      <span style={bite("right")} />
    </div>
  );
}

export function InviteCardArt({ data }: { data: InviteData }) {
  return (
    <div style={card}>
      <Bulbs top={150} />
      <Bulbs top={INVITE_HEIGHT - 168} />

      <div style={{ display: "flex", alignItems: "center", gap: 28, flexShrink: 0 }}>
        <span style={{ flex: 1, height: 4, background: GOLD }} />
        <span style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 700, letterSpacing: 16, color: GOLD }}>NOW SHOWING</span>
        <span style={{ flex: 1, height: 4, background: GOLD }} />
      </div>

      <div style={{ ...clamp(3, titleSize(data.tripTitle), 1.04), fontFamily: DISPLAY, fontWeight: 700, letterSpacing: -2, textAlign: "center", marginTop: 56 }}>
        {data.tripTitle}
      </div>
      <div style={{ ...clamp(2, 40, 1.3), textAlign: "center", marginTop: 28, opacity: 0.85 }}>
        Filming places from {data.films}
      </div>

      <div style={{ flex: 1, minHeight: 40 }} />

      {/* The ticket */}
      <div style={{ border: `4px solid ${GOLD}`, borderRadius: 28, flexShrink: 0 }}>
        <div style={{ padding: "44px 48px 40px", display: "flex", flexDirection: "column", gap: 34 }}>
          <div>
            <div style={label}>Date &amp; time</div>
            <div style={{ ...clamp(2, 50, 1.15), fontFamily: DISPLAY, fontWeight: 700, marginTop: 10 }}>{data.when}</div>
          </div>
          <div>
            <div style={label}>Venue</div>
            <div style={{ ...clamp(2, 50, 1.15), fontFamily: DISPLAY, fontWeight: 700, marginTop: 10 }}>{data.venue}</div>
          </div>
        </div>
        <Perforation />
        <div style={{ padding: "36px 48px 40px", display: "flex" }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Stops</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 96, fontWeight: 700, lineHeight: 1, marginTop: 8 }}>{data.stops}</div>
          </div>
          <div style={{ width: 4, background: GOLD, opacity: 0.35, margin: "0 40px" }} />
          <div style={{ flex: 1 }}>
            <div style={label}>Seats left</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 96, fontWeight: 700, lineHeight: 1, marginTop: 8, color: GOLD }}>
              {data.seatsLeft}
            </div>
          </div>
          {/* Inside the ticket, so a long title can't push the link into Instagram's covered bottom edge. */}
          <div style={{ marginLeft: 32, alignSelf: "center" }}>
            <QrCode text={data.link} size={150} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 44, textAlign: "center", flexShrink: 0 }}>
        <div style={{ ...label, letterSpacing: 4 }}>Get your seat</div>
        <div style={{ ...clamp(2, 36, 1.25), marginTop: 10, fontWeight: 600 }}>{data.linkLabel}</div>
      </div>
    </div>
  );
}
