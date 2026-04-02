"use client";

import { useState } from "react";
import { SemesterCard } from "./semester-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TERM_ORDER } from "@major-map/shared";
import type { PrereqWarning } from "@major-map/planner";

export interface SemesterData {
  id: string;
  term: string;
  year: number;
  courses: Array<{ id: string; courseId: string; code: string; title: string; credits: number }>;
}

interface PlannerGridProps {
  semesters: SemesterData[];
  warnings?: PrereqWarning[];
  onAddSemester: (term: string, year: number) => void;
  onRemoveSemester: (semesterId: string) => void;
  onAddCourse: (semesterId: string, courseId: string) => void;
  onRemoveCourse: (semesterId: string, courseId: string) => void;
}

const sortSemesters = (a: SemesterData, b: SemesterData) =>
  a.year - b.year || (TERM_ORDER[a.term] ?? 3) - (TERM_ORDER[b.term] ?? 3);

export function PlannerGrid({
  semesters,
  warnings = [],
  onAddSemester,
  onRemoveSemester,
  onAddCourse,
  onRemoveCourse,
}: PlannerGridProps) {
  const [newTerm, setNewTerm] = useState("Fall");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [showAddSemester, setShowAddSemester] = useState(false);

  const sorted = [...semesters].sort(sortSemesters);
  const totalCredits = sorted.reduce(
    (sum, s) => sum + s.courses.reduce((cs, c) => cs + c.credits, 0),
    0,
  );

  function handleAddSemester() {
    onAddSemester(newTerm, newYear);
    setShowAddSemester(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {totalCredits} total credits across {sorted.length} semester{sorted.length !== 1 ? "s" : ""}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {sorted.map((semester) => (
          <SemesterCard
            key={semester.id}
            semester={semester}
            warnings={warnings.filter((w) =>
              semester.courses.some((c) => c.courseId === w.courseId),
            )}
            onAddCourse={(courseId) => onAddCourse(semester.id, courseId)}
            onRemoveCourse={(courseId) => onRemoveCourse(semester.id, courseId)}
            onRemoveSemester={() => onRemoveSemester(semester.id)}
          />
        ))}

        {/* Add Semester Card */}
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
          {showAddSemester ? (
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                <select
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                </select>
                <input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(Number(e.target.value))}
                  min={2020}
                  max={2040}
                  className="w-20 rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddSemester}>
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddSemester(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowAddSemester(true)}
              disabled={semesters.length >= 16}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Semester
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
