import type { PlanSemester, CreditSummary } from "./types.js";

/**
 * Computes a credit breakdown for a plan.
 * Separates completed credits from planned credits.
 */
export function creditSummary(
  semesters: PlanSemester[],
  totalRequired: number,
): CreditSummary {
  let planned = 0;
  let completed = 0;

  for (const s of semesters) {
    for (const c of s.courses) {
      if (c.status === "completed") {
        completed += c.credits;
      } else {
        planned += c.credits;
      }
    }
  }

  const total = planned + completed;

  return {
    planned,
    completed,
    remaining: Math.max(0, totalRequired - total),
    totalRequired,
  };
}
