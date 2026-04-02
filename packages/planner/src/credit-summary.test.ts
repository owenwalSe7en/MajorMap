import { describe, expect, it } from "vitest";
import { creditSummary } from "./credit-summary.js";
import type { PlanSemester } from "./types.js";

const makeSemester = (
  credits: number[],
  options?: { status?: "planned" | "completed" },
): PlanSemester => ({
  id: "s1",
  term: "Fall",
  year: 2025,
  courses: credits.map((c, i) => ({
    courseId: `c${i}`,
    code: `CS ${i}`,
    credits: c,
    status: options?.status,
  })),
});

describe("creditSummary", () => {
  it("returns correct planned and remaining for a normal plan", () => {
    const semesters = [makeSemester([3, 3, 4]), makeSemester([3, 3])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 16, completed: 0, remaining: 104, totalRequired: 120 });
  });

  it("returns remaining = 0 when all credits are planned", () => {
    const semesters = [makeSemester([60]), makeSemester([60])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 120, completed: 0, remaining: 0, totalRequired: 120 });
  });

  it("returns remaining = 0 when over-planned (not negative)", () => {
    const semesters = [makeSemester([70]), makeSemester([60])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 130, completed: 0, remaining: 0, totalRequired: 120 });
  });

  it("returns all remaining for an empty plan", () => {
    const result = creditSummary([], 120);
    expect(result).toEqual({ planned: 0, completed: 0, remaining: 120, totalRequired: 120 });
  });

  it("handles fractional credits correctly", () => {
    const semesters = [makeSemester([1.5, 0.5, 3])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 5, completed: 0, remaining: 115, totalRequired: 120 });
  });

  it("handles zero-credit courses", () => {
    const semesters = [makeSemester([0, 3, 0])];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 3, completed: 0, remaining: 117, totalRequired: 120 });
  });

  it("separates completed credits from planned credits", () => {
    const semesters = [
      makeSemester([3, 3, 4], { status: "completed" }),
      makeSemester([3, 3]),
    ];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 6, completed: 10, remaining: 104, totalRequired: 120 });
  });

  it("counts both completed and planned toward remaining", () => {
    const semesters = [
      makeSemester([50], { status: "completed" }),
      makeSemester([50]),
    ];
    const result = creditSummary(semesters, 120);
    expect(result).toEqual({ planned: 50, completed: 50, remaining: 20, totalRequired: 120 });
  });

  it("treats courses with no status as planned (backwards compat)", () => {
    const semesters: PlanSemester[] = [{
      id: "s1",
      term: "Fall",
      year: 2025,
      courses: [
        { courseId: "c1", code: "CS 1400", credits: 3 },  // no status field
        { courseId: "c2", code: "CS 1410", credits: 3, status: "completed", grade: "A" },
      ],
    }];
    const result = creditSummary(semesters, 120);
    expect(result.planned).toBe(3);
    expect(result.completed).toBe(3);
  });

  it("handles all completed plan (no planned courses)", () => {
    const semesters = [
      makeSemester([3, 4, 3], { status: "completed" }),
    ];
    const result = creditSummary(semesters, 10);
    expect(result).toEqual({ planned: 0, completed: 10, remaining: 0, totalRequired: 10 });
  });
});
