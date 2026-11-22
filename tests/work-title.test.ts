import { describe, expect, it } from "vitest";
import { isPlaceholderTitle, storableTitle } from "@/lib/work-title";

describe("work titles", () => {
  it("spots placeholder titles", () => {
    for (const t of ["", "  ", "Unknown", "unknown ", "Untitled", "TBD", "N/A", "?", "-", null, undefined])
      expect(isPlaceholderTitle(t)).toBe(true);
    for (const t of ["Unknown (2011)", "Dark", "The Unknown Soldier", "Title Fight"]) expect(isPlaceholderTitle(t)).toBe(false);
  });
  it("adds the year to a real film named like a placeholder, rejects one without a year", () => {
    expect(storableTitle("Unknown", 2011)).toBe("Unknown (2011)");
    expect(storableTitle("Unknown", null)).toBeNull();
    expect(storableTitle("", 2020)).toBeNull();
    expect(storableTitle(" Dark ", null)).toBe("Dark");
  });
});
