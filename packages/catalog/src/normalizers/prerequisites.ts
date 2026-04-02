import type { CoursedogCourse } from "../schemas/coursedog.js";

export interface NormalizedPrereq {
  course_id: string;
  prerequisite_course_id: string | null;
  group_id: string;
  group_operator: string;
  condition: string;
  min_grade: string | null;
  is_corequisite: boolean;
  description_override: string | null;
  raw_rule: unknown;
}

interface WalkContext {
  courseId: string;
  courseGroupIdMap: Map<string, string>;
  warnings: string[];
}

function extractCourseGroupIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.values)) return [];

  const ids: string[] = [];
  for (const group of v.values) {
    if (group && typeof group === "object" && Array.isArray((group as Record<string, unknown>).value)) {
      for (const id of (group as Record<string, unknown>).value as string[]) {
        if (typeof id === "string") ids.push(id);
      }
    }
  }
  return ids;
}

function walkRules(
  rules: unknown[],
  groupId: string,
  groupOperator: string,
  isCorequisite: boolean,
  ctx: WalkContext,
): NormalizedPrereq[] {
  const result: NormalizedPrereq[] = [];

  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const r = rule as Record<string, unknown>;
    const condition = (r.condition as string) ?? "unknown";
    const ruleId = (r.id as string) ?? groupId;

    if (condition === "anyOf" || condition === "allOf") {
      const subRules = r.subRules as unknown[];
      if (Array.isArray(subRules)) {
        const op = condition === "anyOf" ? "OR" : "AND";
        result.push(...walkRules(subRules, ruleId, op, isCorequisite, ctx));
      }
      continue;
    }

    const courseGroupIds = extractCourseGroupIds(r.value);
    const grade = typeof r.grade === "string" ? r.grade : null;

    if (courseGroupIds.length === 0) {
      result.push({
        course_id: ctx.courseId,
        prerequisite_course_id: null,
        group_id: groupId,
        group_operator: groupOperator,
        condition,
        min_grade: grade,
        is_corequisite: isCorequisite,
        description_override: typeof r.notes === "string" ? r.notes : null,
        raw_rule: rule,
      });
      continue;
    }

    for (const cgId of courseGroupIds) {
      const resolvedId = ctx.courseGroupIdMap.get(cgId) ?? null;
      if (!resolvedId) {
        ctx.warnings.push(`Dangling prereq ref: courseGroupId=${cgId} for course ${ctx.courseId}`);
      }

      result.push({
        course_id: ctx.courseId,
        prerequisite_course_id: resolvedId,
        group_id: groupId,
        group_operator: groupOperator,
        condition,
        min_grade: grade,
        is_corequisite: isCorequisite,
        description_override: null,
        raw_rule: rule,
      });
    }
  }

  return result;
}

export function normalizePrerequisites(
  raw: CoursedogCourse,
  courseId: string,
  courseGroupIdMap: Map<string, string>,
): { prereqs: NormalizedPrereq[]; warnings: string[] } {
  const warnings: string[] = [];
  const prereqs: NormalizedPrereq[] = [];

  const requisites = raw.requisites as Record<string, unknown>;
  const simple = requisites?.requisitesSimple;
  if (!Array.isArray(simple)) return { prereqs, warnings };

  for (const group of simple) {
    if (!group || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;
    const groupId = (g.id as string) ?? "default";
    const type = (g.type as string) ?? "";
    const isCorequisite = type.toLowerCase().includes("corequisite");
    const rules = g.rules as unknown[];

    if (!Array.isArray(rules)) continue;

    const ctx: WalkContext = { courseId, courseGroupIdMap, warnings };
    prereqs.push(...walkRules(rules, groupId, "AND", isCorequisite, ctx));
  }

  return { prereqs, warnings };
}
