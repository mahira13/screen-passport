import { describe, expect, it } from "vitest";
import { cleanProps, isEventName } from "@/lib/analytics";

describe("isEventName", () => {
  it("accepts only the events in CLAUDE.md", () => {
    expect(isEventName("map_viewed")).toBe(true);
    expect(isEventName("trip_created")).toBe(true);
    expect(isEventName("invite_shared")).toBe(true);
    expect(isEventName("page_view")).toBe(false);
    expect(isEventName(42)).toBe(false);
  });
});

describe("cleanProps", () => {
  it("keeps flat values and drops nested, odd or oversized ones", () => {
    expect(cleanProps({ origin: "berlin", places: 12, ok: true, nested: { a: 1 }, list: [1], nan: NaN })).toEqual({
      origin: "berlin", places: 12, ok: true,
    });
    expect(cleanProps({ long: "x".repeat(500) }).long).toHaveLength(100);
    expect(cleanProps({ ["k".repeat(41)]: 1 })).toEqual({});
  });
  it("returns {} for anything that is not a plain object", () => {
    expect(cleanProps(null)).toEqual({});
    expect(cleanProps("x")).toEqual({});
    expect(cleanProps([1, 2])).toEqual({});
  });
});

describe("passport id in events", () => {
  it("keeps a well-formed anonymous passport id and drops anything else", () => {
    expect(cleanProps({ passport: "abcdefghjkmn", work: "dark" })).toEqual({ passport: "abcdefghjkmn", work: "dark" });
    expect(cleanProps({ passport: "someone@example.com" })).toEqual({});
    expect(cleanProps({ passport: 12 })).toEqual({});
  });
  it("accepts the search and page view events", () => {
    expect(isEventName("search")).toBe(true);
    expect(isEventName("page_viewed")).toBe(true);
  });
});
