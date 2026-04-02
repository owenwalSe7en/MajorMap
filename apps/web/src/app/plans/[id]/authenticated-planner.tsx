"use client";

import { useRouter } from "next/navigation";
import { PlannerGrid, type SemesterData } from "./planner-grid";
import * as actions from "../actions";

interface AuthenticatedPlannerProps {
  planId: string;
  initialSemesters: SemesterData[];
}

export function AuthenticatedPlanner({ planId, initialSemesters }: AuthenticatedPlannerProps) {
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
    // For authenticated, courseEntryId is the plan_course row ID
    // We need to find it — the semesterData has courseId (the course UUID), not the plan_courses.id
    // Actually, we pass the plan_courses.id as course.id in the semester data
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
      onAddSemester={handleAddSemester}
      onRemoveSemester={handleRemoveSemester}
      onAddCourse={handleAddCourse}
      onRemoveCourse={handleRemoveCourse}
    />
  );
}
