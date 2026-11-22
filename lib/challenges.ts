// Friend challenges: who has checked in where, and who finished first. Pure.
import { visitProgress, type VisitProgress } from "./collections";

export const MAX_CHALLENGERS = 50;

export type Participant = { passportId: string; name: string; joinedAt: string; finishedAt: string | null };
export type Standing = { name: string; progress: VisitProgress; finishedAt: string | null; you: boolean };

/** The goal: places with a check-in grade pin (approximate pins can't be checked in). */
export const challengeGoal = (places: { id: number; checkIn: boolean }[]) => places.filter((p) => p.checkIn).map((p) => p.id);

/** Finished first (earliest first), then most places, then who joined first. */
export function standings(people: Participant[], goal: number[], visitedOf: Map<string, number[]>, me: string | null = null): Standing[] {
  return people
    .map((p) => ({ p, progress: visitProgress(goal, visitedOf.get(p.passportId) ?? []) }))
    .sort((a, b) =>
      (a.p.finishedAt ? 0 : 1) - (b.p.finishedAt ? 0 : 1)
      || (a.p.finishedAt && b.p.finishedAt ? a.p.finishedAt.localeCompare(b.p.finishedAt) : 0)
      || b.progress.done - a.progress.done
      || a.p.joinedAt.localeCompare(b.p.joinedAt))
    .map(({ p, progress }) => ({ name: p.name, progress, finishedAt: p.finishedAt, you: p.passportId === me }));
}

/** Challenges a passport has just completed: open ones whose goal is now fully visited. */
export function newlyFinished(open: { challengeId: string; goal: number[] }[], visited: number[]): string[] {
  return open.filter((c) => visitProgress(c.goal, visited).complete).map((c) => c.challengeId);
}
