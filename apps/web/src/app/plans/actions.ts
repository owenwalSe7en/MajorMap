"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GuestPlan } from "@/lib/guest-plan";

const VALID_TERMS = ["Fall", "Spring", "Summer"];
const MIN_YEAR = 2020;
const MAX_YEAR = 2040;

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

export async function createPlan(name = "My Plan") {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("semester_plans")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/plans");
  return { planId: data.id };
}

export async function addSemester(planId: string, term: string, year: number) {
  if (!VALID_TERMS.includes(term)) return { error: "Invalid term" };
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return { error: "Invalid year" };

  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("plan_semesters")
    .insert({ plan_id: planId, user_id: user.id, term, year })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/plans");
  return { semesterId: data.id };
}

export async function removeSemester(semesterId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("plan_semesters").delete().eq("id", semesterId);

  if (error) return { error: error.message };
  revalidatePath("/plans");
  return { success: true };
}

export async function addCourse(planSemesterId: string, courseId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("plan_courses")
    .insert({ plan_semester_id: planSemesterId, user_id: user.id, course_id: courseId })
    .select("id")
    .single();

  if (error) {
    // Handle duplicate constraint gracefully
    if (error.code === "23505") return { error: "Course already in this semester" };
    return { error: error.message };
  }
  revalidatePath("/plans");
  return { planCourseId: data.id };
}

export async function removeCourse(planCourseId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("plan_courses").delete().eq("id", planCourseId);

  if (error) return { error: error.message };
  revalidatePath("/plans");
  return { success: true };
}

export async function migrateGuestPlan(guestPlan: GuestPlan) {
  if (typeof guestPlan?.name !== "string" || guestPlan.name.trim().length === 0) {
    return { error: "Plan name is required" };
  }
  if (!Array.isArray(guestPlan.semesters)) {
    return { error: "Invalid plan structure" };
  }
  for (const semester of guestPlan.semesters) {
    if (!VALID_TERMS.includes(semester.term)) {
      return { error: `Invalid term "${semester.term}" in semester` };
    }
    if (!Number.isInteger(semester.year) || semester.year < MIN_YEAR || semester.year > MAX_YEAR) {
      return { error: `Invalid year ${semester.year} in semester` };
    }
    if (!Array.isArray(semester.courseIds) || !semester.courseIds.every((id) => typeof id === "string")) {
      return { error: "Each semester must contain a valid list of course IDs" };
    }
  }

  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // Pre-validate courseIds exist
  const allCourseIds = guestPlan.semesters.flatMap((s) => s.courseIds);
  if (allCourseIds.length > 0) {
    const { data: validCourses } = await supabase
      .from("courses")
      .select("id")
      .in("id", allCourseIds);
    const validIds = new Set(validCourses?.map((c: { id: string }) => c.id) ?? []);
    const invalidCount = allCourseIds.filter((id) => !validIds.has(id)).length;
    if (invalidCount > 0) {
      return { error: `${invalidCount} course(s) no longer exist in the catalog.` };
    }
  }

  // Insert plan
  const { data: plan, error: planError } = await supabase
    .from("semester_plans")
    .insert({ user_id: user.id, name: guestPlan.name })
    .select("id")
    .single();

  if (planError) return { error: planError.message };

  // Insert semesters and courses
  for (const semester of guestPlan.semesters) {
    const { data: dbSemester, error: semError } = await supabase
      .from("plan_semesters")
      .insert({ plan_id: plan.id, user_id: user.id, term: semester.term, year: semester.year })
      .select("id")
      .single();

    if (semError) {
      await supabase.from("semester_plans").delete().eq("id", plan.id);
      return { error: semError.message };
    }

    if (semester.courseIds.length > 0) {
      const courseRows = semester.courseIds.map((courseId) => ({
        plan_semester_id: dbSemester.id,
        user_id: user.id,
        course_id: courseId,
      }));

      const { error: courseError } = await supabase.from("plan_courses").insert(courseRows);

      if (courseError) {
        await supabase.from("semester_plans").delete().eq("id", plan.id);
        return { error: courseError.message };
      }
    }
  }

  revalidatePath("/plans");
  return { success: true, planId: plan.id };
}
