"use client";

import { useRouter } from "next/navigation";
import { PlannerGrid, type SemesterData } from "./planner-grid";
import * as actions from "../actions";
import type { PrereqWarning } from "@major-map/planner";

interface AuthenticatedPlannerProps {
  planId: string;
  initialSemesters: SemesterData[];
  warnings: PrereqWarning[];
}

export function AuthenticatedPlanner({ planId, initialSemesters, warnings }: AuthenticatedPlannerProps) {
  const router = useRouter();

  async function handleAddSemester(term: string, year: number) {
    const result = await actions.addSemester(planId, term, year);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemoveSemester(semesterId: string) {
    await actions.removeSemester(semesterId);
    router.refresh();
  }

  async function handleAddCourse(semesterId: string, courseId: string) {
    const result = await actions.addCourse(semesterId, courseId);
    if (result.error) {
      if (result.error !== "Course already in this semester") alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemoveCourse(semesterId: string, courseEntryId: string) {
    const semester = initialSemesters.find((s) => s.id === semesterId);
    const courseEntry = semester?.courses.find((c) => c.courseId === courseEntryId);
    if (courseEntry) {
      await actions.removeCourse(courseEntry.id);
      router.refresh();
    }
  }

  return (
    <PlannerGrid
      semesters={initialSemesters}
      warnings={warnings}
      onAddSemester={handleAddSemester}
      onRemoveSemester={handleRemoveSemester}
      onAddCourse={handleAddCourse}
      onRemoveCourse={handleRemoveCourse}
    />
  );
}
