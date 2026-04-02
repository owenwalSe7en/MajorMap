"use client";

import { useState, useEffect } from "react";
import {
  loadGuestPlan,
  saveGuestPlan,
  createGuestPlan,
  addSemesterToGuest,
  removeSemesterFromGuest,
  addCourseToGuest,
  removeCourseFromGuest,
  type GuestPlan,
} from "@/lib/guest-plan";
import { fetchCoursesByIds, type CourseDisplay } from "@/lib/course-lookup";
import { fetchPrereqRules } from "@/lib/prereq-lookup";
import { PlannerGrid, type SemesterData } from "./[id]/planner-grid";
import { CreditSidebar } from "./[id]/credit-sidebar";
import { Button } from "@/components/ui/button";
import { validateSemesters } from "@major-map/planner";
import type { PrereqRule, PlanSemester } from "@major-map/planner";

export function GuestPlanner() {
  const [plan, setPlan] = useState<GuestPlan | null>(null);
  const [courseMap, setCourseMap] = useState<Map<string, CourseDisplay>>(new Map());
  const [prereqRules, setPrereqRules] = useState<PrereqRule[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    const loaded = loadGuestPlan();
    setPlan(loaded);
    setIsHydrated(true);
  }, []);

  // Stable course ID key — only refetch when the set of courses actually changes
  const courseIdKey = plan?.semesters.flatMap((s) => s.courseIds).sort().join(",") ?? "";

  // Fetch course display data and prereq rules when course set changes
  useEffect(() => {
    if (!plan) return;
    const allIds = plan.semesters.flatMap((s) => s.courseIds);
    if (allIds.length === 0) {
      setCourseMap(new Map());
      setPrereqRules([]);
      return;
    }
    fetchCoursesByIds(allIds).then(setCourseMap);
    fetchPrereqRules(allIds).then((result) => {
      setPrereqRules(result.rules);
      // Fetch codes for prereq courses not already in courseMap
      const missingIds = result.prereqCourseIds.filter((id) => !allIds.includes(id));
      if (missingIds.length > 0) {
        fetchCoursesByIds(missingIds).then((extraMap) => {
          setCourseMap((prev) => {
            const merged = new Map(prev);
            for (const [k, v] of extraMap) merged.set(k, v);
            return merged;
          });
        });
      }
    });
  }, [courseIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function updatePlan(newPlan: GuestPlan) {
    setPlan(newPlan);
    saveGuestPlan(newPlan);
  }

  function handleCreatePlan() {
    const newPlan = createGuestPlan();
    updatePlan(newPlan);
  }

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h2 className="text-xl font-display tracking-tight">Start planning your degree</h2>
        <p className="text-sm text-muted-foreground">
          No account needed. Your plan is saved in your browser.
        </p>
        <Button onClick={handleCreatePlan}>Get Started</Button>
      </div>
    );
  }

  // Convert guest plan to SemesterData format
  const semesterData: SemesterData[] = plan.semesters.map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: s.courseIds.map((courseId) => {
      const display = courseMap.get(courseId);
      return {
        id: courseId,
        courseId,
        code: display?.code ?? "...",
        title: display?.title ?? "Loading...",
        credits: display?.credits ?? 0,
      };
    }),
  }));

  // Compute prereq warnings
  const courseCodeMap = new Map<string, string>();
  for (const [id, display] of courseMap) {
    courseCodeMap.set(id, display.code);
  }

  const planSemesters: PlanSemester[] = semesterData.map((s) => ({
    id: s.id,
    term: s.term,
    year: s.year,
    courses: s.courses.map((c) => ({ courseId: c.courseId, code: c.code, credits: c.credits })),
  }));

  const warnings = validateSemesters(planSemesters, prereqRules, courseCodeMap);

  const totalPlanned = planSemesters.reduce(
    (sum: number, s) => sum + s.courses.reduce((cs: number, c) => cs + c.credits, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 min-w-0">
        <PlannerGrid
          semesters={semesterData}
          warnings={warnings}
          onAddSemester={(term, year) => updatePlan(addSemesterToGuest(plan, term, year))}
          onRemoveSemester={(semId) => updatePlan(removeSemesterFromGuest(plan, semId))}
          onAddCourse={(semId, courseId) => updatePlan(addCourseToGuest(plan, semId, courseId))}
          onRemoveCourse={(semId, courseId) => updatePlan(removeCourseFromGuest(plan, semId, courseId))}
        />
      </div>
      <aside className="order-first lg:order-none lg:w-64 shrink-0">
        <CreditSidebar credits={null} totalPlanned={totalPlanned} />
      </aside>
    </div>
  );
}
