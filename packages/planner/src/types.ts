/** A prerequisite rule for a course (trimmed to fields prerequisiteCheck reads). */
export interface PrereqRule {
  courseId: string;
  prerequisiteCourseId: string | null;
  groupId: string;
  groupOperator: "AND" | "OR";
  isCorequisite: boolean;
}

/** Result of a prerequisite check for a single course. */
export interface PrereqResult {
  met: boolean;
  missing: string[];
}

/** A prerequisite warning for display. */
export interface PrereqWarning {
  courseId: string;
  courseCode: string;
  missing: Array<{ courseId: string; courseCode: string }>;
}

/** A course in a plan semester. */
export interface PlanCourse {
  courseId: string;
  code: string;
  credits: number;
  status?: "planned" | "completed";
  grade?: string;
}

/** A semester in a plan. */
export interface PlanSemester {
  id: string;
  term: string;
  year: number;
  courses: PlanCourse[];
}

/** Credit summary for a plan. */
export interface CreditSummary {
  planned: number;
  completed: number;
  remaining: number;
  totalRequired: number;
}
