import { TERM_ORDER } from "@major-map/shared";
import type { PrereqRule, PrereqResult, PrereqWarning, PlanSemester } from "./types.js";

/**
 * Checks whether a single course's prerequisites are satisfied.
 * Rules with null prerequisiteCourseId (freetext) are skipped.
 * All groups must pass for the course to be considered met.
 */
export function prerequisiteCheck(
  courseId: string,
  completedCourseIds: Set<string>,
  prereqRules: PrereqRule[],
): PrereqResult {
  const rules = prereqRules.filter(
    (r) => r.courseId === courseId && r.prerequisiteCourseId !== null,
  );

  if (rules.length === 0) return { met: true, missing: [] };

  // Group rules by groupId
  const groups = new Map<string, PrereqRule[]>();
  for (const rule of rules) {
    const group = groups.get(rule.groupId);
    if (group) {
      group.push(rule);
    } else {
      groups.set(rule.groupId, [rule]);
    }
  }

  const missing: string[] = [];

  for (const [, groupRules] of groups) {
    const operator = groupRules[0].groupOperator;

    if (operator === "AND") {
      for (const rule of groupRules) {
        if (!completedCourseIds.has(rule.prerequisiteCourseId!)) {
          missing.push(rule.prerequisiteCourseId!);
        }
      }
    } else {
      // OR: at least one must be met
      const anyMet = groupRules.some((r) =>
        completedCourseIds.has(r.prerequisiteCourseId!),
      );
      if (!anyMet) {
        for (const rule of groupRules) {
          missing.push(rule.prerequisiteCourseId!);
        }
      }
    }
  }

  return { met: missing.length === 0, missing };
}

/**
 * Validates all courses across all semesters for prerequisite issues.
 * Semesters are sorted chronologically. Corequisites are satisfied by
 * same-semester courses; regular prereqs require prior semesters only.
 */
export function validateSemesters(
  semesters: PlanSemester[],
  prereqRules: PrereqRule[],
  courseCodeMap: Map<string, string>,
): PrereqWarning[] {
  const sorted = [...semesters].sort(
    (a, b) =>
      a.year - b.year ||
      (TERM_ORDER[a.term] ?? 3) - (TERM_ORDER[b.term] ?? 3),
  );

  const completedCourseIds = new Set<string>();
  const warnings: PrereqWarning[] = [];

  for (const semester of sorted) {
    const currentSemesterIds = new Set(semester.courses.map((c) => c.courseId));

    for (const course of semester.courses) {
      const courseRules = prereqRules.filter((r) => r.courseId === course.courseId);
      if (courseRules.length === 0) continue;

      // Split rules into regular prereqs and corequisites
      const regularRules = courseRules.filter((r) => !r.isCorequisite);
      const coreqRules = courseRules.filter((r) => r.isCorequisite);

      // Regular prereqs: check against prior semesters only
      const regularResult = prerequisiteCheck(course.courseId, completedCourseIds, regularRules);

      // Corequisites: check against prior + current semester
      const withCurrentSemester = new Set([...completedCourseIds, ...currentSemesterIds]);
      const coreqResult = prerequisiteCheck(course.courseId, withCurrentSemester, coreqRules);

      // Merge missing from both checks
      const allMissing = [...regularResult.missing, ...coreqResult.missing];

      if (allMissing.length > 0) {
        warnings.push({
          courseId: course.courseId,
          courseCode: courseCodeMap.get(course.courseId) ?? course.code,
          missing: allMissing.map((id) => ({
            courseId: id,
            courseCode: courseCodeMap.get(id) ?? id,
          })),
        });
      }
    }

    // Add this semester's courses to completed set for next iteration
    for (const course of semester.courses) {
      completedCourseIds.add(course.courseId);
    }
  }

  return warnings;
}
