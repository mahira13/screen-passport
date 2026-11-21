import { describe, expect, it } from "vitest";
import { matchTitle, normaliseTitle, searchWorks } from "@/lib/match";
import type { Work } from "@/lib/types";

const w = (id: string, title: string, aliases: string[] = []): Work => ({
  id, title, type: "film", aliases, year: null,
});

const works: Work[] = [
  w("queens-gambit", "The Queen's Gambit", ["Das Damengambit", "Queen's Gambit"]),
  w("bridge-of-spies", "Bridge of Spies", ["Bridge of Spies – Der Unterhändler"]),
  w("mockingjay-2", "The Hunger Games: Mockingjay – Part 2", ["Die Tribute von Panem – Mockingjay Teil 2", "Mockingjay"]),
  w("bourne-supremacy", "The Bourne Supremacy", ["Die Bourne Verschwörung"]),
  w("unknown-2011", "Unknown", ["Unknown Identity"]),
  w("dark", "Dark"),
  w("the-reader", "The Reader", ["Der Vorleser"]),
];

describe("normaliseTitle", () => {
  it("folds case, accents, punctuation and leading articles", () => {
    expect(normaliseTitle("The Queen's Gambit")).toBe("queens gambit");
    expect(normaliseTitle("  das   DAMENGAMBIT ")).toBe("damengambit");
    expect(normaliseTitle("Die Bourne Verschwörung")).toBe("bourne verschworung");
    expect(normaliseTitle("Straße")).toBe("strasse");
    expect(normaliseTitle("Unknown (2011)")).toBe("unknown");
    expect(normaliseTitle("Fast & Furious")).toBe("fast and furious");
  });
  it("keeps a title that is only an article-like word", () => {
    expect(normaliseTitle("Dark")).toBe("dark");
  });
});

describe("matchTitle", () => {
  it("matches titles and aliases in English and German", () => {
    expect(matchTitle("queens gambit", works)?.id).toBe("queens-gambit");
    expect(matchTitle("Das Damengambit", works)?.id).toBe("queens-gambit");
    expect(matchTitle("DER VORLESER", works)?.id).toBe("the-reader");
    expect(matchTitle("Die Bourne Verschwoerung".replace("oe", "ö"), works)?.id).toBe("bourne-supremacy");
    expect(matchTitle("Mockingjay", works)?.id).toBe("mockingjay-2");
    expect(matchTitle("Unknown (2011)", works)?.id).toBe("unknown-2011");
  });
  it("returns null for unknown, empty or partial titles", () => {
    expect(matchTitle("Stranger Things", works)).toBeNull();
    expect(matchTitle("   ", works)).toBeNull();
    expect(matchTitle("Bourne", works)).toBeNull();
  });
  it("returns null when two works share a name", () => {
    expect(matchTitle("Dark", [...works, w("dark-2", "Dark")])).toBeNull();
  });
});

describe("searchWorks", () => {
  it("ranks prefix matches before word matches", () => {
    const ids = searchWorks("b", works).map((x) => x.id);
    expect(ids.slice(0, 2)).toEqual(["bourne-supremacy", "bridge-of-spies"]);
  });
  it("finds works by a word inside an alias", () => {
    expect(searchWorks("panem", works).map((x) => x.id)).toEqual(["mockingjay-2"]);
    expect(searchWorks("damen", works).map((x) => x.id)).toEqual(["queens-gambit"]);
  });
  it("returns nothing for empty or unmatched queries and respects the limit", () => {
    expect(searchWorks("", works)).toEqual([]);
    expect(searchWorks("zzz", works)).toEqual([]);
    expect(searchWorks("e", works, 2)).toHaveLength(2);
  });
});
