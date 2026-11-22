import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "@/lib/qr";
import { linkLabel, shareUrl } from "@/lib/share-link";

describe("qrMatrix", () => {
  it("is square with finder patterns in three corners", () => {
    const m = qrMatrix("https://screenpassport.app/p/aB3dE5fG7hJ9");
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === n)).toBe(true);
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      expect(m[r][c]).toBe(true); // outer ring of the finder
      expect(m[r + 1][c + 1]).toBe(false); // white ring
      expect(m[r + 3][c + 3]).toBe(true); // centre
    }
  });
});

describe("qrPath", () => {
  it("draws one unit square per dark module, offset by the quiet zone", () => {
    expect(qrPath([[true, false], [false, true]], 4)).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");
  });
});

describe("shareUrl / linkLabel", () => {
  it("joins the site and path without a double slash", () => {
    expect(shareUrl("https://screenpassport.app/", "/p/abc")).toBe("https://screenpassport.app/p/abc");
  });
  it("drops the scheme, www and a trailing slash for the printed label", () => {
    expect(linkLabel("https://www.screenpassport.app/trip/abc/")).toBe("screenpassport.app/trip/abc");
  });
});
