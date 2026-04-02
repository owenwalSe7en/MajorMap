import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthenticatedPlanner } from "./authenticated-planner";
import { CreditSidebar } from "./credit-sidebar";
import { ImportTranscriptButton } from "./import-transcript-button";
import { SuggestionsPanel } from "./suggestions-panel";
import { validateSemesters, creditSummary, suggestCourses } from "@major-map/planner";
import type { PrereqRule, PrereqWarning, PlanSemester, CreditSummary, RequirementItem, SuggestedCourse } from "@major-map/planner";

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
        .select("id, plan_semester_id, course_id, status, grade, courses(code, title, credits)")
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
          status: (c as { status?: string }).status as "planned" | "completed" | undefined,
          grade: (c as { grade?: string }).grade,
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

  // Parallelize independent queries: prereq course codes + program data + requirements
  const [prereqCoursesResult, programResult, reqSetResult] = await Promise.all([
    prereqCourseIds.length > 0
      ? supabase.from("courses").select("id, code").in("id", prereqCourseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; code: string }> }),
    plan.program_id
      ? supabase.from("programs").select("total_credits").eq("id", plan.program_id).single()
      : Promise.resolve({ data: null }),
    plan.program_id
      ? supabase.from("requirement_sets").select("id").eq("program_id", plan.program_id).eq("is_active", true).single()
      : Promise.resolve({ data: null }),
  ]);

  const prereqCourses = prereqCoursesResult.data ?? [];
  const courseCodeMap = new Map<string, string>();
  for (const c of courses ?? []) {
    const courseData = c.courses as unknown as CourseJoin;
    if (courseData) courseCodeMap.set(c.course_id, courseData.code);
  }
  for (const c of prereqCourses) {
    courseCodeMap.set(c.id, c.code);
  }

  // Compute warnings using planner pure functions
  const planSemesters: PlanSemester[] = semesterData.map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: s.courses.map((c) => ({ courseId: c.courseId, code: c.code, credits: c.credits, status: c.status, grade: c.grade })),
  }));

  const warnings: PrereqWarning[] = validateSemesters(planSemesters, prereqRules, courseCodeMap);

  // --- Sprint 4: Credit summary ---
  let credits: CreditSummary | null = null;
  const program = programResult.data as { total_credits: number | null } | null;
  if (program?.total_credits != null) {
    credits = creditSummary(planSemesters, program.total_credits);
  }

  const totalPlanned = planSemesters.reduce(
    (sum: number, s) => sum + s.courses.reduce((cs: number, c) => cs + c.credits, 0),
    0,
  );

  // --- Sprint 6: Course suggestions ---
  let suggestions: SuggestedCourse[] = [];
  const activeReqSet = reqSetResult.data as { id: string } | null;

  if (activeReqSet) {
    // Fetch requirement items + all prereq rules for candidates + candidate course details
    const { data: reqItems } = await supabase
      .from("requirement_items")
      .select("id, course_id, label, parent_id")
      .eq("requirement_set_id", activeReqSet.id);

    if (reqItems && reqItems.length > 0) {
      // Build parent label map for categories
      const itemsById = new Map((reqItems as Array<{ id: string; course_id: string | null; label: string; parent_id: string | null }>).map((r) => [r.id, r]));
      const requirementItems: RequirementItem[] = (reqItems as Array<{ id: string; course_id: string | null; label: string; parent_id: string | null }>).map((r) => ({
        id: r.id,
        courseId: r.course_id,
        label: r.label,
        parentId: r.parent_id,
        parentLabel: r.parent_id ? (itemsById.get(r.parent_id)?.label ?? "Requirements") : "Requirements",
      }));

      // Get candidate course IDs (required but not in plan)
      const planCourseIdSet = new Set(allCourseIds);
      const candidateCourseIds = requirementItems
        .filter((ri) => ri.courseId !== null && !planCourseIdSet.has(ri.courseId))
        .map((ri) => ri.courseId!);

      if (candidateCourseIds.length > 0) {
        // Fetch candidate course details + their prereq rules in parallel
        const [candidateCoursesResult, candidatePrereqsResult] = await Promise.all([
          supabase.from("courses").select("id, code, title, credits").in("id", candidateCourseIds),
          supabase.from("course_prerequisites")
            .select("course_id, prerequisite_course_id, group_id, group_operator, is_corequisite")
            .in("course_id", candidateCourseIds),
        ]);

        const candidateCourses = (candidateCoursesResult.data ?? []) as Array<{ id: string; code: string; title: string; credits: number }>;
        const candidatePrereqs: PrereqRule[] = (candidatePrereqsResult.data ?? []).map((r: { course_id: string; prerequisite_course_id: string | null; group_id: string; group_operator: string; is_corequisite: boolean }) => ({
          courseId: r.course_id,
          prerequisiteCourseId: r.prerequisite_course_id,
          groupId: r.group_id,
          groupOperator: r.group_operator as "AND" | "OR",
          isCorequisite: r.is_corequisite,
        }));

        // Combine all prereq rules (plan courses + candidates)
        const allPrereqRules = [...prereqRules, ...candidatePrereqs];

        const planCoursesForSuggestions = allCourseIds.map((courseId) => {
          const pc = (courses ?? []).find((c) => c.course_id === courseId);
          return { courseId, status: (pc as { status?: string })?.status };
        });

        suggestions = suggestCourses(
          planCoursesForSuggestions,
          requirementItems,
          allPrereqRules,
          candidateCourses,
        );
      }
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-display tracking-tight">{plan.name}</h1>
        <ImportTranscriptButton planId={id} />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 min-w-0">
          <AuthenticatedPlanner planId={id} initialSemesters={semesterData} warnings={warnings} />
        </div>
        <aside className="order-first lg:order-none lg:w-72 shrink-0 space-y-4">
          <CreditSidebar credits={credits} totalPlanned={totalPlanned} />
          <SuggestionsPanel
            suggestions={suggestions}
            semesters={semesterData}
            hasProgram={!!plan.program_id}
          />
        </aside>
      </div>
    </main>
  );
}
