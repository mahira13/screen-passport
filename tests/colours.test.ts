import { describe, expect, it } from "vitest";
import { colourMap, lightness, OTHER_COLOUR, TITLE_PALETTE } from "@/lib/colours";

describe("palette", () => {
  it("has 8 distinct colours", () => {
    expect(new Set(TITLE_PALETTE).size).toBe(8);
  });
  it("every colour differs in lightness from every other by at least 8 L*", () => {
    const ls = TITLE_PALETTE.map(lightness);
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) expect(Math.abs(ls[i] - ls[j]), `${TITLE_PALETTE[i]} vs ${TITLE_PALETTE[j]}`).toBeGreaterThanOrEqual(8);
  });
  it("lightness() matches known values", () => {
    expect(lightness("#FFFFFF")).toBeCloseTo(100, 0);
    expect(lightness("#000000")).toBeCloseTo(0, 0);
    expect(lightness("#777777")).toBeCloseTo(50, 0);
  });
});

describe("colourMap", () => {
  it("gives the first eight titles palette colours and the rest grey", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `w${i}`);
    const m = colourMap(ids);
    expect(m.get("w0")).toBe(TITLE_PALETTE[0]);
    expect(m.get("w7")).toBe(TITLE_PALETTE[7]);
    expect(m.get("w8")).toBe(OTHER_COLOUR);
    expect(m.get("w9")).toBe(OTHER_COLOUR);
  });
});
