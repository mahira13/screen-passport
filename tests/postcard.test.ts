import { describe, expect, it } from "vitest";
import { cleanCaption, coverCrop, postcardLayout, POSTCARD_SIZE } from "@/lib/postcard";

describe("postcard", () => {
  it("photo and band fit inside the card and do not overlap", () => {
    for (const f of ["4:5", "9:16"] as const) {
      const { photo, band } = postcardLayout(f);
      expect(photo.y + photo.h).toBeLessThanOrEqual(band.y);
      expect(band.y + band.h).toBe(POSTCARD_SIZE[f].h);
    }
  });
  it("crops the centre of the photo without stretching", () => {
    expect(coverCrop(4000, 3000, { w: 1000, h: 500 })).toEqual({ x: 0, y: 500, w: 4000, h: 2000 });
    expect(coverCrop(1000, 2000, { w: 1000, h: 1000 })).toEqual({ x: 0, y: 500, w: 1000, h: 1000 });
  });
  it("keeps captions to one short line", () => {
    expect(cleanCaption("  We  made\nit! ")).toBe("We made it!");
    expect(cleanCaption("x".repeat(100))).toHaveLength(80);
  });
});
