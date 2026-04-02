"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, Trash2, CheckCircle2 } from "lucide-react";
import { AddCourse } from "./add-course";
import type { SemesterData } from "./planner-grid";
import type { PrereqWarning } from "@major-map/planner";

interface SemesterCardProps {
  semester: SemesterData;
  warnings?: PrereqWarning[];
  onAddCourse: (courseId: string) => void;
  onRemoveCourse: (courseId: string) => void;
  onRemoveSemester: () => void;
}

const PRIOR_COURSEWORK_YEAR = 2020;

export function SemesterCard({
  semester,
  warnings = [],
  onAddCourse,
  onRemoveCourse,
  onRemoveSemester,
}: SemesterCardProps) {
  const [showSearch, setShowSearch] = useState(false);
  const totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0);
  const existingCourseIds = semester.courses.map((c) => c.courseId);

  const isPriorCoursework = semester.term === "Fall" && semester.year === PRIOR_COURSEWORK_YEAR;

  return (
    <Card className={`flex flex-col gap-0 p-0 ${isPriorCoursework ? "border-green-200 dark:border-green-900" : ""}`}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-medium">
          {isPriorCoursework ? (
            <span className="text-green-700 dark:text-green-400">Prior Coursework</span>
          ) : (
            `${semester.term} ${semester.year}`
          )}
        </h3>
        {!isPriorCoursework && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemoveSemester}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="flex-1 p-4">
        {semester.courses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No courses added yet</p>
        ) : (
          <ul className="space-y-2">
            {semester.courses.map((course) => {
              const isCompleted = course.status === "completed";
              const warning = warnings.find((w) => w.courseId === course.courseId);
              return (
                <li
                  key={course.id}
                  className={`space-y-1 rounded-md px-2 py-1.5 ${
                    isCompleted ? "bg-green-50 dark:bg-green-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0 flex items-start gap-1.5">
                      {isCompleted && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
                        <p className="truncate text-sm">{course.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isCompleted && course.grade && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {course.grade}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{course.credits}cr</span>
                      {!isCompleted && (
                        <button
                          onClick={() => onRemoveCourse(course.courseId)}
                          className="rounded p-0.5 hover:bg-muted"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  {warning && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-600 text-[10px] leading-tight"
                    >
                      Missing: {warning.missing.map((m) => m.courseCode).join(", ")}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isPriorCoursework && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{totalCredits} credits</span>
            {showSearch ? (
              <AddCourse
                excludeCourseIds={existingCourseIds}
                onSelect={(courseId) => {
                  onAddCourse(courseId);
                  setShowSearch(false);
                }}
                onClose={() => setShowSearch(false)}
              />
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowSearch(true)}>
                + Add Course
              </Button>
            )}
          </div>
        </div>
      )}

      {isPriorCoursework && (
        <div className="border-t px-4 py-3">
          <span className="text-xs text-green-600 dark:text-green-400">{totalCredits} credits completed</span>
        </div>
      )}
    </Card>
  );
}
