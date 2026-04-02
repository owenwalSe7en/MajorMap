"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Lightbulb, Loader2 } from "lucide-react";
import { addCourse } from "../actions";
import type { SuggestedCourse } from "@major-map/planner";
import type { SemesterData } from "./planner-grid";

interface SuggestionsPanelProps {
  suggestions: SuggestedCourse[];
  semesters: SemesterData[];
  planId: string;
  hasProgram: boolean;
}

export function SuggestionsPanel({ suggestions, semesters, planId, hasProgram }: SuggestionsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [addingCourseId, setAddingCourseId] = useState<string | null>(null);
  const router = useRouter();

  if (!hasProgram) {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Suggestions</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a program to get course suggestions.
        </p>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-medium">All Set</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          All requirements are planned or completed. Review your schedule.
        </p>
      </Card>
    );
  }

  // Derive categories from suggestions
  const categories = [...new Set(suggestions.map((s) => s.category))];
  const filtered = activeCategory
    ? suggestions.filter((s) => s.category === activeCategory)
    : suggestions;

  // Default target semester: last non-prior-coursework semester
  const targetSemesters = semesters.filter((s) => !(s.term === "Fall" && s.year === 2020));
  const defaultSemester = targetSemesters[targetSemesters.length - 1];

  async function handleAdd(courseId: string, semesterId: string) {
    setAddingCourseId(courseId);
    await addCourse(semesterId, courseId);
    setAddingCourseId(null);
    router.refresh();
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium">Suggested Courses</h3>
        <Badge variant="secondary" className="text-[10px]">{suggestions.length}</Badge>
      </div>

      {/* Category filter pills */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            className={`rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
              activeCategory === null ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            }`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
                activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Suggestion list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.map((suggestion) => (
          <div key={suggestion.courseId} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground">{suggestion.code}</span>
                <p className="text-xs truncate">{suggestion.title}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{suggestion.credits}cr</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <Badge variant="outline" className="text-[9px] leading-tight">
                {suggestion.reason}
              </Badge>
              {defaultSemester && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={addingCourseId === suggestion.courseId}
                  onClick={() => handleAdd(suggestion.courseId, defaultSemester.id)}
                >
                  {addingCourseId === suggestion.courseId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-0.5" />
                      Add
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
