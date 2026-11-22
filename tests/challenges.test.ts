import { describe, expect, it } from "vitest";
import { challengeGoal, newlyFinished, standings } from "@/lib/challenges";

const goal = [1, 2, 3];
const p = (passportId: string, name: string, joinedAt: string, finishedAt: string | null = null) => ({ passportId, name, joinedAt, finishedAt });

describe("challenges", () => {
  it("the goal is only the places you can check in at", () => {
    expect(challengeGoal([{ id: 1, checkIn: true }, { id: 2, checkIn: false }, { id: 3, checkIn: true }])).toEqual([1, 3]);
  });

  it("ranks who finished first, then most places, then who joined first", () => {
    const visited = new Map([["a", [1]], ["b", [1, 2, 3]], ["c", [1, 2, 3]], ["d", [1, 2]], ["e", [9]]]);
    const s = standings([
      p("a", "Ana", "2026-01-01"), p("b", "Ben", "2026-01-02", "2026-02-05"),
      p("c", "Cem", "2026-01-03", "2026-02-01"), p("d", "Dora", "2026-01-04"), p("e", "Eli", "2026-01-00"),
    ], goal, visited, "d");
    expect(s.map((x) => [x.name, x.progress.done, x.you])).toEqual([
      ["Cem", 3, false], ["Ben", 3, false], ["Dora", 2, true], ["Ana", 1, false], ["Eli", 0, false],
    ]);
  });

  it("finds the challenges a check-in completes", () => {
    expect(newlyFinished([{ challengeId: "x", goal: [1, 2] }, { challengeId: "y", goal: [1, 5] }, { challengeId: "z", goal: [] }], [1, 2, 3])).toEqual(["x"]);
  });
});
