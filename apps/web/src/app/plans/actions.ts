"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTranscript, PASSING_GRADE_SET, ALL_GRADES } from "@major-map/planner";
import { UTAH_UNIVERSITY_ID } from "@major-map/shared";
import type { GuestPlan } from "@/lib/guest-plan";

const VALID_TERMS = ["Fall", "Spring", "Summer"];
const MIN_YEAR = 2020;
const MAX_YEAR = 2040;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

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

  // New plans default to Utah until a school-choice step exists in plan
  // creation; the column anchors transcript matching and program validation.
  const { data, error } = await supabase
    .from("semester_plans")
    .insert({ user_id: user.id, name, university_id: UTAH_UNIVERSITY_ID })
    .select("id")
    .single();

  if (error) return { error: "Could not create plan" };
  revalidatePath("/plans");
  return { planId: data.id };
}

export async function addSemester(planId: string, term: string, year: number) {
  if (!VALID_TERMS.includes(term)) return { error: "Invalid term" };
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return { error: "Invalid year" };

  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // RLS only checks the inserted row's user_id — verify the parent plan is
  // actually ours, or an attacker could squat (plan, term, year) slots on a
  // victim's plan via the unique constraint.
  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();
  if (!plan) return { error: "Plan not found" };

  const { data, error } = await supabase
    .from("plan_semesters")
    .insert({ plan_id: planId, user_id: user.id, term, year })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "That semester already exists" };
    return { error: "Could not add semester" };
  }
  revalidatePath("/plans");
  return { semesterId: data.id };
}

export async function removeSemester(semesterId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("plan_semesters")
    .delete()
    .eq("id", semesterId)
    .eq("user_id", user.id);

  if (error) return { error: "Could not remove semester" };
  revalidatePath("/plans");
  return { success: true };
}

export async function addCourse(planSemesterId: string, courseId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // Same parent-ownership rule as addSemester: never insert under a semester
  // we can't prove is ours.
  const { data: semester } = await supabase
    .from("plan_semesters")
    .select("id")
    .eq("id", planSemesterId)
    .eq("user_id", user.id)
    .single();
  if (!semester) return { error: "Semester not found" };

  const { data, error } = await supabase
    .from("plan_courses")
    .insert({ plan_semester_id: planSemesterId, user_id: user.id, course_id: courseId })
    .select("id")
    .single();

  if (error) {
    // Handle duplicate constraint gracefully
    if (error.code === "23505") return { error: "Course already in this semester" };
    return { error: "Could not add course" };
  }
  revalidatePath("/plans");
  return { planCourseId: data.id };
}

export async function removeCourse(planCourseId: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("plan_courses")
    .delete()
    .eq("id", planCourseId)
    .eq("user_id", user.id);

  if (error) return { error: "Could not remove course" };
  revalidatePath("/plans");
  return { success: true };
}

/**
 * Sets (or clears, with null) the program a plan is working toward. Changing
 * or clearing the program never touches planned courses — credits and
 * suggestions simply recompute on the next render.
 */
export async function setPlanProgram(planId: string, programId: string | null) {
  if (!isUuid(planId)) return { error: "Invalid plan" };
  if (programId !== null && !isUuid(programId)) return { error: "Invalid program" };

  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id, secondary_program_id, university_id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();
  if (!plan) return { error: "Plan not found" };

  if (programId !== null) {
    if (programId === plan.secondary_program_id) {
      return { error: "That program is already your comparison program" };
    }
    const { data: program } = await supabase
      .from("programs")
      .select("id, university_id")
      .eq("id", programId)
      .single();
    if (!program) return { error: "Program not found" };
    // Cross-school guard: attaching another school's program would corrupt
    // suggestions and transcript scoping.
    if (plan.university_id && program.university_id !== plan.university_id) {
      return { error: "That program belongs to a different school" };
    }
  }

  // A 0-row update means the plan vanished or isn't ours — RLS makes that a
  // silent no-op, so check the returned row instead of trusting "no error".
  const { data: updated, error } = await supabase
    .from("semester_plans")
    .update({ program_id: programId })
    .eq("id", planId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !updated) return { error: "Plan not found" };
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

  // Carry the guest's chosen program over when it still exists. The guest
  // payload comes from localStorage (fully client-controlled), so the id is
  // validated against the catalog rather than trusted; an unknown program is
  // dropped instead of blocking the migration.
  let programId: string | null = null;
  if (isUuid(guestPlan.programId)) {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("id", guestPlan.programId)
      .single();
    if (program) programId = guestPlan.programId;
  }

  // Insert plan
  const { data: plan, error: planError } = await supabase
    .from("semester_plans")
    .insert({
      user_id: user.id,
      name: guestPlan.name,
      university_id: UTAH_UNIVERSITY_ID,
      ...(programId ? { program_id: programId } : {}),
    })
    .select("id")
    .single();

  if (planError || !plan) return { error: "Could not create plan" };

  // Insert semesters and courses
  for (const semester of guestPlan.semesters) {
    const { data: dbSemester, error: semError } = await supabase
      .from("plan_semesters")
      .insert({ plan_id: plan.id, user_id: user.id, term: semester.term, year: semester.year })
      .select("id")
      .single();

    if (semError) {
      await supabase.from("semester_plans").delete().eq("id", plan.id);
      return { error: "Could not migrate plan" };
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
        return { error: "Could not migrate plan" };
      }
    }
  }

  revalidatePath("/plans");
  return { success: true, planId: plan.id };
}

// --- Transcript Import ---

export interface MatchedCourse {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  grade: string;
  isPassingGrade: boolean;
}

export interface UnmatchedCourse {
  subjectCode: string;
  number: string;
  grade: string;
}

const MAX_TRANSCRIPT_LENGTH = 50_000;

type ParseResult =
  | { error: string }
  | { matched: MatchedCourse[]; unmatched: UnmatchedCourse[]; skippedLines: number; totalCredits: number };

export async function parseTranscriptAction(planId: string, text: string): Promise<ParseResult> {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  if (typeof text !== "string" || text.length > MAX_TRANSCRIPT_LENGTH) {
    return { error: "Invalid input" };
  }

  // Matching is scoped to the plan's school — codes like "CS 1400" exist at
  // every university, and an unscoped lookup would match another school's
  // course rows once a second catalog is seeded.
  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id, university_id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();
  if (!plan) return { error: "Plan not found" };
  const universityId = plan.university_id ?? UTAH_UNIVERSITY_ID;

  const { courses: parsed, skippedLines } = parseTranscript(text);

  if (parsed.length === 0) {
    return { matched: [] as MatchedCourse[], unmatched: [] as UnmatchedCourse[], skippedLines, totalCredits: 0 };
  }

  // Single query using the generated `code` column
  const codes = parsed.map((c) => `${c.subjectCode} ${c.number}`);
  const { data: dbCourses } = await supabase
    .from("courses")
    .select("id, code, title, credits")
    .eq("university_id", universityId)
    .in("code", codes);

  const codeToDb = new Map(
    (dbCourses ?? []).map((c: { id: string; code: string; title: string; credits: number }) => [c.code, c]),
  );

  const matched: MatchedCourse[] = [];
  const unmatched: UnmatchedCourse[] = [];

  for (const pc of parsed) {
    const code = `${pc.subjectCode} ${pc.number}`;
    const db = codeToDb.get(code);
    if (db) {
      matched.push({
        courseId: db.id,
        code: db.code,
        title: db.title,
        credits: db.credits,
        grade: pc.grade,
        isPassingGrade: PASSING_GRADE_SET.has(pc.grade),
      });
    } else {
      unmatched.push({ subjectCode: pc.subjectCode, number: pc.number, grade: pc.grade });
    }
  }

  const totalCredits = matched.reduce((s, c) => s + c.credits, 0);
  return { matched, unmatched, skippedLines, totalCredits };
}

type ImportResult = { error: string } | { success: true; importedCount: number };

export async function importTranscriptCourses(
  planId: string,
  courses: Array<{ courseId: string; grade: string }>,
): Promise<ImportResult> {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  if (!Array.isArray(courses) || courses.length === 0) {
    return { error: "No courses to import" };
  }

  if (courses.length > 200) return { error: "Too many courses" };

  const GRADE_SET = new Set<string>(ALL_GRADES);
  for (const c of courses) {
    if (typeof c.courseId !== "string" || typeof c.grade !== "string") {
      return { error: "Invalid course data" };
    }
    if (!GRADE_SET.has(c.grade)) {
      return { error: "Invalid grade value" };
    }
  }

  // Verify plan ownership (RLS ensures only owner's plan returned)
  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id")
    .eq("id", planId)
    .single();
  if (!plan) return { error: "Plan not found" };

  // Validate courseIds exist
  const courseIds = courses.map((c) => c.courseId);
  const { data: validCourses } = await supabase
    .from("courses")
    .select("id")
    .in("id", courseIds);
  const validIds = new Set(validCourses?.map((c: { id: string }) => c.id) ?? []);
  const invalidCount = courseIds.filter((id) => !validIds.has(id)).length;
  if (invalidCount > 0) {
    return { error: `${invalidCount} course(s) not found in catalog` };
  }

  // Find or create "Prior Coursework" semester (Fall 2020)
  const { data: existing } = await supabase
    .from("plan_semesters")
    .select("id")
    .eq("plan_id", planId)
    .eq("term", "Fall")
    .eq("year", MIN_YEAR)
    .maybeSingle();

  let semesterId: string;
  if (existing) {
    semesterId = existing.id;
  } else {
    const { data: newSem, error: semError } = await supabase
      .from("plan_semesters")
      .insert({ plan_id: planId, user_id: user.id, term: "Fall", year: MIN_YEAR })
      .select("id")
      .single();
    if (semError) return { error: "Failed to create semester" };
    semesterId = newSem.id;
  }

  // Upsert plan_courses with status='completed'
  const rows = courses.map((c) => ({
    plan_semester_id: semesterId,
    user_id: user.id,
    course_id: c.courseId,
    status: "completed" as const,
    grade: c.grade,
  }));

  const { error: upsertError } = await supabase
    .from("plan_courses")
    .upsert(rows, { onConflict: "plan_semester_id,course_id" });

  if (upsertError) return { error: "Failed to import courses" };

  revalidatePath("/plans");
  return { success: true, importedCount: rows.length };
}
