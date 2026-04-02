import type { PlanSemester, CreditSummary } from "./types.js";

/**
 * Computes a credit breakdown for a plan.
 * No past/future split — just total planned vs required.
 */
export function creditSummary(
  semesters: PlanSemester[],
  totalRequired: number,
): CreditSummary {
  const planned = semesters.reduce(
    (sum, s) => sum + s.courses.reduce((cs, c) => cs + c.credits, 0),
    0,
  );

  return {
    planned,
    remaining: Math.max(0, totalRequired - planned),
    totalRequired,
  };
}
