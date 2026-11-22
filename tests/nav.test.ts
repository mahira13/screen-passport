import { describe, expect, it } from "vitest";
import { activeNav, legacyHashTarget, NAV, passportHref } from "@/lib/nav";

describe("NAV", () => {
  it("has the four sections in order", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Discover", "Collections", "Map", "My Passport"]);
  });
});

describe("activeNav", () => {
  it.each([
    ["/discover", "discover"], ["/collections", "collections"], ["/map", "map"],
    ["/passport", "passport"], ["/p/abc123", "passport"],
  ])("%s -> %s", (path, key) => expect(activeNav(path)).toBe(key));
  it.each(["/", "/trip/new", "/trip/x", "/privacy", "/mapping", "/admin/locations"])("%s -> none", (path) =>
    expect(activeNav(path)).toBeNull());
});

describe("passportHref", () => {
  it("opens the saved passport, or the passport page without one", () => {
    expect(passportHref("abc")).toBe("/p/abc");
    expect(passportHref(null)).toBe("/passport");
  });
});

describe("legacyHashTarget", () => {
  it("sends old home anchors to their new pages", () => {
    expect(legacyHashTarget("#discover")).toBe("/discover");
    expect(legacyHashTarget("#index")).toBe("/discover#index");
    expect(legacyHashTarget("#collections")).toBe("/collections");
    expect(legacyHashTarget("")).toBeNull();
    expect(legacyHashTarget("#other")).toBeNull();
  });
});
