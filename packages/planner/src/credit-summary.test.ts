import { describe, expect, it } from "vitest";
import { creditSummary } from "./credit-summary.js";
import type { PlanSemester } from "./types.js";

const makeSemester = (credits: number[]): PlanSemester => ({
  id: "s1",
  term: "Fall",
  year: 2025,
  courses: credits.map((c, i) => ({ courseId: `c${i}`, code: `CS ${i}`, credits: c })),
});

describe("creditSummary", () => {
  it("returns correct planned and remaining for a normal plan", () => {
    const semesters = [makeSemester([3, 3, 4]), makeSemester([3, 3])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 16, remaining: 104, totalRequired: 120 });
  });

  it("returns remaining = 0 when all credits are planned", () => {
    const semesters = [makeSemester([60]), makeSemester([60])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 120, remaining: 0, totalRequired: 120 });
  });

  it("returns remaining = 0 when over-planned (not negative)", () => {
    const semesters = [makeSemester([70]), makeSemester([60])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 130, remaining: 0, totalRequired: 120 });
  });

  it("returns all remaining for an empty plan", () => {
    const result = creditSummary([], 120);
    expect(result).toEqual({ planned: 0, remaining: 120, totalRequired: 120 });
  });

  it("handles fractional credits correctly", () => {
    const semesters = [makeSemester([1.5, 0.5, 3])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 5, remaining: 115, totalRequired: 120 });
  });

  it("handles zero-credit courses", () => {
    const semesters = [makeSemester([0, 3, 0])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 3, remaining: 117, totalRequired: 120 });
  });
});
