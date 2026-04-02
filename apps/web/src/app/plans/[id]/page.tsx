import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthenticatedPlanner } from "./authenticated-planner";

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
  const semesterData = (semesters ?? []).map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: (courses ?? [])
      .filter((c) => c.plan_semester_id === s.id)
      .map((c) => ({
        id: c.id,
        courseId: c.course_id,
        code: (c.courses as { code: string; title: string; credits: number })?.code ?? "",
        title: (c.courses as { code: string; title: string; credits: number })?.title ?? "",
        credits: (c.courses as { code: string; title: string; credits: number })?.credits ?? 0,
      })),
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display tracking-tight">{plan.name}</h1>
      </div>
      <AuthenticatedPlanner planId={id} initialSemesters={semesterData} />
    </main>
  );
}
