import { createClient } from "@/lib/supabase/client";
import type { PrereqRule } from "@major-map/planner";

interface PrereqLookupResult {
  rules: PrereqRule[];
  prereqCourseIds: string[];
}

export async function fetchPrereqRules(courseIds: string[]): Promise<PrereqLookupResult> {
  if (courseIds.length === 0) return { rules: [], prereqCourseIds: [] };

  const supabase = createClient();
  const { data } = await supabase
    .from("course_prerequisites")
    .select("course_id, prerequisite_course_id, group_id, group_operator, is_corequisite")
    .in("course_id", courseIds);

  const rules: PrereqRule[] = (data ?? []).map((r) => ({
    courseId: r.course_id,
    prerequisiteCourseId: r.prerequisite_course_id,
    groupId: r.group_id,
    groupOperator: r.group_operator as "AND" | "OR",
    isCorequisite: r.is_corequisite,
  }));

  const prereqCourseIds = (data ?? [])
    .map((r) => r.prerequisite_course_id)
    .filter((id): id is string => id !== null);

  return { rules, prereqCourseIds };
}
