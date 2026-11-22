import { describe, expect, it } from "vitest";
import { adminToken, isValidPassword, isValidToken } from "@/lib/admin";
import { parseLatLng } from "@/lib/distance";
import { isUntrustedSource } from "@/lib/sources";

describe("admin password", () => {
  it("accepts only the right password", () => {
    expect(isValidPassword("s3cret", "s3cret")).toBe(true);
    expect(isValidPassword("wrong", "s3cret")).toBe(false);
  });
  it("is switched off when no password is configured", () => {
    expect(isValidPassword("", "")).toBe(false);
    expect(isValidPassword("x", undefined)).toBe(false);
    expect(isValidToken(adminToken(""), "")).toBe(false);
  });
  it("checks the cookie token and never uses the raw password", () => {
    expect(adminToken("s3cret")).not.toContain("s3cret");
    expect(isValidToken(adminToken("s3cret"), "s3cret")).toBe(true);
    expect(isValidToken(adminToken("old"), "s3cret")).toBe(false);
    expect(isValidToken(undefined, "s3cret")).toBe(false);
  });
});

describe("parseLatLng", () => {
  it("parses valid input", () => {
    expect(parseLatLng("52.5163", " 13.3803 ")).toEqual({ lat: 52.5163, lng: 13.3803 });
  });
  it.each([["", "13"], ["52", ""], ["abc", "13"], ["91", "13"], ["52", "181"], [null, "13"]])(
    "rejects %s, %s",
    (lat, lng) => expect(parseLatLng(lat, lng)).toBeNull(),
  );
});

describe("isUntrustedSource", () => {
  it("rejects Wikipedia, fan wikis and broken URLs", () => {
    expect(isUntrustedSource("https://en.wikipedia.org/wiki/Dark")).toBe(true);
    expect(isUntrustedSource("https://en.wikipedia.com/wiki/Making_Unorthodox")).toBe(true);
    expect(isUntrustedSource("https://dark-netflix.fandom.com/wiki/Winden")).toBe(true);
    expect(isUntrustedSource("not a url")).toBe(true);
  });
  it("rejects Wikidata as the only evidence for a published place", () => {
    expect(isUntrustedSource("https://www.wikidata.org/wiki/Q123")).toBe(true);
  });
  it("accepts tourism sites and guides", () => {
    expect(isUntrustedSource("https://www.visitberlin.de/en/node/2120789")).toBe(false);
    expect(isUntrustedSource("https://www.atlasofwonders.com/2020/07/x.html")).toBe(false);
  });
});
