import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthenticatedPlanner } from "./authenticated-planner";
import { CreditSidebar } from "./credit-sidebar";
import { validateSemesters, creditSummary } from "@major-map/planner";
import type { PrereqRule, PrereqWarning, PlanSemester, CreditSummary } from "@major-map/planner";

export const metadata = { title: "My Plan" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/plans");
  }

  // Fetch plan with semesters and courses
  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id, name, program_id")
    .eq("id", id)
    .single();

  if (!plan) {
    redirect("/plans");
  }

  const { data: semesters } = await supabase
    .from("plan_semesters")
    .select("id, term, year")
    .eq("plan_id", id)
    .order("year")
    .order("term");

  const semesterIds = (semesters ?? []).map((s) => s.id);

  const { data: courses } = semesterIds.length > 0
    ? await supabase
        .from("plan_courses")
        .select("id, plan_semester_id, course_id, courses(code, title, credits)")
        .in("plan_semester_id", semesterIds)
    : { data: [] };

  // Assemble semester data
  type CourseJoin = { code: string; title: string; credits: number } | null;
  const semesterData = (semesters ?? []).map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: (courses ?? [])
      .filter((c) => c.plan_semester_id === s.id)
      .map((c) => {
        const joined = c.courses as unknown as CourseJoin;
        return {
          id: c.id,
          courseId: c.course_id,
          code: joined?.code ?? "",
          title: joined?.title ?? "",
          credits: joined?.credits ?? 0,
        };
      }),
  }));

  // --- Sprint 4: Prereq warnings ---
  const allCourseIds = (courses ?? []).map((c) => c.course_id);

  const { data: prereqRows } = allCourseIds.length > 0
    ? await supabase
        .from("course_prerequisites")
        .select("course_id, prerequisite_course_id, group_id, group_operator, is_corequisite")
        .in("course_id", allCourseIds)
    : { data: [] };

  // Map DB rows to PrereqRule shape
  const prereqRules: PrereqRule[] = (prereqRows ?? []).map((r) => ({
    courseId: r.course_id,
    prerequisiteCourseId: r.prerequisite_course_id,
    groupId: r.group_id,
    groupOperator: r.group_operator as "AND" | "OR",
    isCorequisite: r.is_corequisite,
  }));

  // Build courseCodeMap: need codes for prereq courses not in the plan
  const prereqCourseIds = (prereqRows ?? [])
    .map((r) => r.prerequisite_course_id)
    .filter((id): id is string => id !== null && !allCourseIds.includes(id));

  const { data: prereqCourses } = prereqCourseIds.length > 0
    ? await supabase.from("courses").select("id, code").in("id", prereqCourseIds)
    : { data: [] };

  const courseCodeMap = new Map<string, string>();
  for (const c of courses ?? []) {
    const courseData = c.courses as unknown as CourseJoin;
    if (courseData) courseCodeMap.set(c.course_id, courseData.code);
  }
  for (const c of prereqCourses ?? []) {
    courseCodeMap.set(c.id, c.code);
  }

  // Compute warnings using planner pure functions
  const planSemesters: PlanSemester[] = semesterData.map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: s.courses.map((c) => ({ courseId: c.courseId, code: c.code, credits: c.credits })),
  }));

  const warnings: PrereqWarning[] = validateSemesters(planSemesters, prereqRules, courseCodeMap);

  // --- Sprint 4: Credit summary ---
  let credits: CreditSummary | null = null;
  if (plan.program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("total_credits")
      .eq("id", plan.program_id)
      .single();
    if (program?.total_credits != null) {
      credits = creditSummary(planSemesters, program.total_credits);
    }
  }

  const totalPlanned = planSemesters.reduce(
    (sum: number, s) => sum + s.courses.reduce((cs: number, c) => cs + c.credits, 0),
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display tracking-tight">{plan.name}</h1>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 min-w-0">
          <AuthenticatedPlanner planId={id} initialSemesters={semesterData} warnings={warnings} />
        </div>
        <aside className="order-first lg:order-none lg:w-64 shrink-0">
          <CreditSidebar credits={credits} totalPlanned={totalPlanned} />
        </aside>
      </div>
    </main>
  );
}
