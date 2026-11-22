import { describe, expect, it } from "vitest";
import { commonsFile, distinctCovers, typeYear } from "@/lib/covers";
import type { Photo } from "@/lib/nearby";

const ph = (file: string, size = 500): Photo => ({
  url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/${size}px-${file}`, author: "A", license: "CC BY 4.0", licenseUrl: null,
  page: `https://commons.wikimedia.org/wiki/File:${file}`,
});

describe("distinctCovers", () => {
  it("never gives two cards the same Commons file, falling back to the next photo", () => {
    const a = ph("A.jpg"), b = ph("B.jpg"), c = ph("C.jpg");
    expect(distinctCovers([[a, b], [a, b], [a, c]])).toEqual([a, b, c]);
  });
  it("treats two sizes of one file as the same file", () => {
    expect(commonsFile(ph("A.jpg", 250))).toBe(commonsFile(ph("A.jpg", 960)));
    expect(distinctCovers([[ph("A.jpg", 250)], [ph("A.jpg", 960)]])).toEqual([ph("A.jpg", 250), null]);
  });
  it("skips photos already used elsewhere on the screen and empty slots", () => {
    const a = ph("A.jpg"), b = ph("B.jpg");
    expect(distinctCovers([[null, a, b]], [a])).toEqual([b]);
  });
});

describe("typeYear", () => {
  it("shows type and year from the data", () => {
    expect(typeYear("series", 2017)).toBe("Series · 2017");
    expect(typeYear("film", null)).toBe("Film");
  });
});
