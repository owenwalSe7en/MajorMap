import type { CoursedogCourse } from "../schemas/coursedog.js";
import { courseUuid, departmentUuid } from "../uuid.js";

export interface NormalizedCourse {
  id: string;
  university_id: string;
  department_id: string | null;
  subject_code: string;
  number: string;
  title: string;
  description: string;
  credits_min: number;
  credits_max: number;
  typically_offered: string[];
  coursedog_id: string;
  course_group_id: string;
  raw_data: Record<string, unknown>;
}

export function normalizeCourse(
  raw: CoursedogCourse,
  universitySlug: string,
  universityId: string,
): NormalizedCourse {
  const deptCode = raw.departments[0] ?? null;

  return {
    id: courseUuid(universitySlug, raw.subjectCode, raw.courseNumber),
    university_id: universityId,
    department_id: deptCode ? departmentUuid(universitySlug, deptCode) : null,
    subject_code: raw.subjectCode,
    number: raw.courseNumber,
    title: raw.longName || raw.name,
    description: raw.description,
    credits_min: raw.credits.creditHours.min,
    credits_max: raw.credits.creditHours.max,
    typically_offered: [],
    coursedog_id: raw._id,
    course_group_id: raw.courseGroupId,
    raw_data: raw as unknown as Record<string, unknown>,
  };
}

export function buildCourseGroupIdMap(
  courses: NormalizedCourse[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of courses) {
    map.set(c.course_group_id, c.id);
  }
  return map;
}
