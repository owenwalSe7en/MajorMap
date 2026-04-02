import { describe, expect, it } from "vitest";
import { prerequisiteCheck, validateSemesters } from "./prerequisite-check.js";
import type { PrereqRule, PlanSemester } from "./types.js";

describe("prerequisiteCheck", () => {
  it("returns met when course has no prereq rules", () => {
    const result = prerequisiteCheck("c1", new Set(["c2"]), []);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("returns met when AND group is fully satisfied", () => {
    const rules: PrereqRule[] = [
      { courseId: "c3", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c3", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "AND", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c3", new Set(["c1", "c2"]), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("returns not met when AND group has a missing prereq", () => {
    const rules: PrereqRule[] = [
      { courseId: "c3", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c3", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "AND", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c3", new Set(["c1"]), rules);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual(["c2"]);
  });

  it("returns met when OR group has at least one satisfied", () => {
    const rules: PrereqRule[] = [
      { courseId: "c3", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "OR", isCorequisite: false },
      { courseId: "c3", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "OR", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c3", new Set(["c2"]), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("returns not met when OR group has none satisfied", () => {
    const rules: PrereqRule[] = [
      { courseId: "c3", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "OR", isCorequisite: false },
      { courseId: "c3", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "OR", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c3", new Set(), rules);
    expect(result.met).toBe(false);
    expect(result.missing).toContain("c1");
    expect(result.missing).toContain("c2");
  });

  it("handles mixed AND + OR groups where all groups must pass", () => {
    const rules: PrereqRule[] = [
      // AND group: need both c1 and c2
      { courseId: "c5", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c5", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      // OR group: need c3 or c4
      { courseId: "c5", prerequisiteCourseId: "c3", groupId: "g2", groupOperator: "OR", isCorequisite: false },
      { courseId: "c5", prerequisiteCourseId: "c4", groupId: "g2", groupOperator: "OR", isCorequisite: false },
    ];
    // Has c1, c2, c3 → AND group met, OR group met
    const result = prerequisiteCheck("c5", new Set(["c1", "c2", "c3"]), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("fails when one group passes but another fails", () => {
    const rules: PrereqRule[] = [
      { courseId: "c5", prerequisiteCourseId: "c1", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c5", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c5", prerequisiteCourseId: "c3", groupId: "g2", groupOperator: "OR", isCorequisite: false },
    ];
    // Has c1 and c2 but not c3 → AND passes, OR fails
    const result = prerequisiteCheck("c5", new Set(["c1", "c2"]), rules);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual(["c3"]);
  });

  it("skips freetext-only prereqs (null prerequisiteCourseId)", () => {
    const rules: PrereqRule[] = [
      { courseId: "c1", prerequisiteCourseId: null, groupId: "g1", groupOperator: "AND", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c1", new Set(), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("returns met when all rules are freetext", () => {
    const rules: PrereqRule[] = [
      { courseId: "c1", prerequisiteCourseId: null, groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "c1", prerequisiteCourseId: null, groupId: "g2", groupOperator: "OR", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c1", new Set(), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });

  it("ignores rules for other courses", () => {
    const rules: PrereqRule[] = [
      { courseId: "c1", prerequisiteCourseId: "c2", groupId: "g1", groupOperator: "AND", isCorequisite: false },
      { courseId: "other", prerequisiteCourseId: "c3", groupId: "g2", groupOperator: "AND", isCorequisite: false },
    ];
    const result = prerequisiteCheck("c1", new Set(["c2"]), rules);
    expect(result).toEqual({ met: true, missing: [] });
  });
});

describe("validateSemesters", () => {
  const makeRules = (...rules: Partial<PrereqRule>[]): PrereqRule[] =>
    rules.map((r) => ({
      courseId: r.courseId ?? "",
      prerequisiteCourseId: r.prerequisiteCourseId ?? null,
      groupId: r.groupId ?? "g1",
      groupOperator: r.groupOperator ?? "AND",
      isCorequisite: r.isCorequisite ?? false,
    }));

  const makeSemester = (id: string, term: string, year: number, courses: Array<{ courseId: string; code: string; credits?: number }>): PlanSemester => ({
    id,
    term,
    year,
    courses: courses.map((c) => ({ courseId: c.courseId, code: c.code, credits: c.credits ?? 3 })),
  });

  it("returns empty array when no prereq issues", () => {
    const semesters: PlanSemester[] = [
      makeSemester("s1", "Fall", 2025, [{ courseId: "c1", code: "CS 1410" }]),
      makeSemester("s2", "Spring", 2026, [{ courseId: "c2", code: "CS 2420" }]),
    ];
    const rules = makeRules({ courseId: "c2", prerequisiteCourseId: "c1" });
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 2420"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    expect(warnings).toEqual([]);
  });

  it("returns warning when a prerequisite is missing", () => {
    const semesters: PlanSemester[] = [
      makeSemester("s1", "Fall", 2025, [{ courseId: "c2", code: "CS 2420" }]),
    ];
    const rules = makeRules({ courseId: "c2", prerequisiteCourseId: "c1" });
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 2420"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].courseId).toBe("c2");
    expect(warnings[0].courseCode).toBe("CS 2420");
    expect(warnings[0].missing).toEqual([{ courseId: "c1", courseCode: "CS 1410" }]);
  });

  it("treats corequisite in same semester as met", () => {
    const semesters: PlanSemester[] = [
      makeSemester("s1", "Fall", 2025, [
        { courseId: "c1", code: "CS 1410" },
        { courseId: "c2", code: "CS 1400" },
      ]),
    ];
    const rules = makeRules({ courseId: "c2", prerequisiteCourseId: "c1", isCorequisite: true });
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 1400"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    expect(warnings).toEqual([]);
  });

  it("warns when regular prereq is only in same semester (not prior)", () => {
    const semesters: PlanSemester[] = [
      makeSemester("s1", "Fall", 2025, [
        { courseId: "c1", code: "CS 1410" },
        { courseId: "c2", code: "CS 2420" },
      ]),
    ];
    const rules = makeRules({ courseId: "c2", prerequisiteCourseId: "c1", isCorequisite: false });
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 2420"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].courseId).toBe("c2");
  });

  it("returns multiple warnings for multiple courses with issues", () => {
    const semesters: PlanSemester[] = [
      makeSemester("s1", "Fall", 2025, [
        { courseId: "c3", code: "CS 3500" },
        { courseId: "c4", code: "CS 3810" },
      ]),
    ];
    const rules = makeRules(
      { courseId: "c3", prerequisiteCourseId: "c1" },
      { courseId: "c4", prerequisiteCourseId: "c2" },
    );
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 2420"], ["c3", "CS 3500"], ["c4", "CS 3810"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    expect(warnings).toHaveLength(2);
  });

  it("sorts semesters by year then term before validating", () => {
    // Put Spring before Fall in the array — validation should still sort correctly
    const semesters: PlanSemester[] = [
      makeSemester("s2", "Spring", 2026, [{ courseId: "c2", code: "CS 2420" }]),
      makeSemester("s1", "Fall", 2025, [{ courseId: "c1", code: "CS 1410" }]),
    ];
    const rules = makeRules({ courseId: "c2", prerequisiteCourseId: "c1" });
    const codeMap = new Map([["c1", "CS 1410"], ["c2", "CS 2420"]]);
    const warnings = validateSemesters(semesters, rules, codeMap);
    // Fall 2025 is before Spring 2026 so c1 is completed before c2 — no warning
    expect(warnings).toEqual([]);
  });
});
