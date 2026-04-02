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
import { PlannerGrid, type SemesterData } from "./[id]/planner-grid";
import { Button } from "@/components/ui/button";

export function GuestPlanner() {
  const [plan, setPlan] = useState<GuestPlan | null>(null);
  const [courseMap, setCourseMap] = useState<Map<string, CourseDisplay>>(new Map());
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    const loaded = loadGuestPlan();
    setPlan(loaded);
    setIsHydrated(true);
  }, []);

  // Fetch course display data when plan changes
  useEffect(() => {
    if (!plan) return;
    const allIds = plan.semesters.flatMap((s) => s.courseIds);
    if (allIds.length === 0) {
      setCourseMap(new Map());
      return;
    }
    fetchCoursesByIds(allIds).then(setCourseMap);
  }, [plan]);

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
        id: courseId, // For guest, use courseId as the entry ID
        courseId,
        code: display?.code ?? "...",
        title: display?.title ?? "Loading...",
        credits: display?.credits ?? 0,
      };
    }),
  }));

  return (
    <PlannerGrid
      semesters={semesterData}
      onAddSemester={(term, year) => updatePlan(addSemesterToGuest(plan, term, year))}
      onRemoveSemester={(semId) => updatePlan(removeSemesterFromGuest(plan, semId))}
      onAddCourse={(semId, courseId) => updatePlan(addCourseToGuest(plan, semId, courseId))}
      onRemoveCourse={(semId, courseId) => updatePlan(removeCourseFromGuest(plan, semId, courseId))}
    />
  );
}
