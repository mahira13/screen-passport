// Map colours per title. Each colour sits at its own lightness step
// (CIELAB L* 92 → 22, 10 apart), so they stay tellable apart in greyscale
// and for colour-blind users. Chips always name the title as well.
export const TITLE_PALETTE = [
  "#F9EC4F", // yellow   L* 92
  "#7ED8F6", // sky      L* 82
  "#FB984E", // orange   L* 72
  "#49A95B", // green    L* 62
  "#C64FA0", // magenta  L* 52
  "#B03A2F", // brick    L* 42
  "#1F498F", // blue     L* 32
  "#003D3D", // teal     L* 22
] as const;

export const OTHER_COLOUR = "#8A8F98"; // titles after the first eight

/** Colour by position: the closest titles get the palette, the rest grey. */
export function colourMap(workIds: string[]): Map<string, string> {
  return new Map(workIds.map((id, i) => [id, TITLE_PALETTE[i] ?? OTHER_COLOUR]));
}

/** CIELAB lightness (0–100) of a #RRGGBB colour. */
export function lightness(hex: string): number {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}
