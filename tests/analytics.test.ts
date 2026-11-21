import { describe, expect, it } from "vitest";
import { cleanProps, isEventName } from "@/lib/analytics";

describe("isEventName", () => {
  it("accepts only the events in CLAUDE.md", () => {
    expect(isEventName("map_viewed")).toBe(true);
    expect(isEventName("trip_created")).toBe(true);
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
