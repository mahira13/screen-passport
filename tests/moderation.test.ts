import { describe, expect, it } from "vitest";
import { containsOffensive, containsUrl, isCleanText } from "@/lib/moderation";

describe("containsUrl", () => {
  it("finds links in many shapes", () => {
    for (const t of ["https://x.y", "see www.spam.net", "spam.com", "join bit.ly/abc", "meet at evil (dot) de"])
      expect(containsUrl(t), t).toBe(true);
  });
  it("leaves normal text alone", () => {
    for (const t of ["Brandenburger Tor", "St. Marien", "Dr. Who fan meet", "Café am Neuen See"])
      expect(containsUrl(t), t).toBe(false);
  });
});

describe("containsOffensive", () => {
  it("catches swear words, slurs and simple swaps", () => {
    for (const t of ["fuck this", "Scheiße", "SCHEISSTRIP", "f.u.c.k", "Hurensohn", "h1tler walk", "Arschloch"])
      expect(containsOffensive(t), t).toBe(true);
  });
  it("lets real names and places through", () => {
    for (const t of ["Dick", "Scunthorpe", "Hannah", "Sussex", "Essex walk", "Ana", "Klassenfahrt", "Heilbronn"])
      expect(containsOffensive(t), t).toBe(false);
  });
});

describe("isCleanText", () => {
  it("combines both checks", () => {
    expect(isCleanText("Alexanderplatz, by the clock")).toBe(true);
    expect(isCleanText("bit.ly/x")).toBe(false);
  });
});
