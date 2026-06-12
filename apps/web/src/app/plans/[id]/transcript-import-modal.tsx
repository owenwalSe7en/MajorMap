"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { parseTranscriptAction, importTranscriptCourses } from "../actions";
import type { MatchedCourse, UnmatchedCourse } from "../actions";

interface TranscriptImportModalProps {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "paste" | "preview";

interface State {
  step: Step;
  text: string;
  loading: boolean;
  error: string | null;
  matched: MatchedCourse[];
  unmatched: UnmatchedCourse[];
  selectedIds: Set<string>;
  totalCredits: number;
  skippedLines: number;
  importing: boolean;
}

type Action =
  | { type: "SET_TEXT"; text: string }
  | { type: "PARSE_START" }
  | { type: "PARSE_SUCCESS"; matched: MatchedCourse[]; unmatched: UnmatchedCourse[]; totalCredits: number; skippedLines: number }
  | { type: "PARSE_ERROR"; error: string }
  | { type: "TOGGLE_COURSE"; courseId: string }
  | { type: "TOGGLE_ALL" }
  | { type: "GO_BACK" }
  | { type: "IMPORT_START" }
  | { type: "IMPORT_ERROR"; error: string }
  | { type: "RESET" };

const initialState: State = {
  step: "paste",
  text: "",
  loading: false,
  error: null,
  matched: [],
  unmatched: [],
  selectedIds: new Set(),
  totalCredits: 0,
  skippedLines: 0,
  importing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TEXT":
      return { ...state, text: action.text, error: null };
    case "PARSE_START":
      return { ...state, loading: true, error: null };
    case "PARSE_SUCCESS": {
      const passingIds = new Set(
        action.matched.filter((c) => c.isPassingGrade).map((c) => c.courseId),
      );
      return {
        ...state,
        step: "preview",
        loading: false,
        matched: action.matched,
        unmatched: action.unmatched,
        selectedIds: passingIds,
        totalCredits: action.totalCredits,
        skippedLines: action.skippedLines,
      };
    }
    case "PARSE_ERROR":
      return { ...state, loading: false, error: action.error };
    case "TOGGLE_COURSE": {
      const next = new Set(state.selectedIds);
      if (next.has(action.courseId)) {
        next.delete(action.courseId);
      } else {
        next.add(action.courseId);
      }
      return { ...state, selectedIds: next };
    }
    case "TOGGLE_ALL": {
      const passingCourses = state.matched.filter((c) => c.isPassingGrade);
      const allSelected = passingCourses.every((c) => state.selectedIds.has(c.courseId));
      const next = allSelected
        ? new Set<string>()
        : new Set(passingCourses.map((c) => c.courseId));
      return { ...state, selectedIds: next };
    }
    case "GO_BACK":
      return { ...state, step: "paste", error: null };
    case "IMPORT_START":
      return { ...state, importing: true, error: null };
    case "IMPORT_ERROR":
      return { ...state, importing: false, error: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function TranscriptImportModal({ planId, open, onOpenChange }: TranscriptImportModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    if (!next) dispatch({ type: "RESET" });
    onOpenChange(next);
  }

  async function handleParse() {
    if (!state.text.trim()) return;
    dispatch({ type: "PARSE_START" });

    const result = await parseTranscriptAction(state.text);
    if ("error" in result) {
      dispatch({ type: "PARSE_ERROR", error: result.error });
      return;
    }

    const { matched, unmatched, totalCredits, skippedLines } = result;

    if (matched.length === 0 && unmatched.length === 0) {
      dispatch({ type: "PARSE_ERROR", error: "No courses found in the pasted text. Check the format and try again." });
      return;
    }

    dispatch({ type: "PARSE_SUCCESS", matched, unmatched, totalCredits, skippedLines });
  }

  async function handleImport() {
    const selected = state.matched.filter((c) => state.selectedIds.has(c.courseId));
    if (selected.length === 0) return;

    dispatch({ type: "IMPORT_START" });
    const result = await importTranscriptCourses(
      planId,
      selected.map((c) => ({ courseId: c.courseId, grade: c.grade })),
    );

    if ("error" in result && result.error) {
      dispatch({ type: "IMPORT_ERROR", error: result.error });
      return;
    }

    handleOpenChange(false);
    router.refresh();
  }

  const selectedCredits = state.matched
    .filter((c) => state.selectedIds.has(c.courseId))
    .reduce((s, c) => s + c.credits, 0);

  const passingCourses = state.matched.filter((c) => c.isPassingGrade);
  const allSelected = passingCourses.length > 0 && passingCourses.every((c) => state.selectedIds.has(c.courseId));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {state.step === "paste" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Transcript</DialogTitle>
              <DialogDescription>
                Paste your unofficial UofU transcript below. We&apos;ll match courses against the catalog.
              </DialogDescription>
            </DialogHeader>

            <textarea
              className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground"
              placeholder={"CS  1400  Introduction to Computer Science  3.00  A\nMATH  1210  Calculus I  4.00  B+\n..."}
              value={state.text}
              onChange={(e) => dispatch({ type: "SET_TEXT", text: e.target.value })}
              disabled={state.loading}
            />

            {state.error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button onClick={handleParse} disabled={state.loading || !state.text.trim()}>
                {state.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Parse Transcript
              </Button>
            </DialogFooter>
          </>
        )}

        {state.step === "preview" && (
          <>
            <DialogHeader>
              <DialogTitle>Review Courses</DialogTitle>
              <DialogDescription>
                {state.matched.length} matched, {state.unmatched.length} unmatched, {state.skippedLines} lines skipped
              </DialogDescription>
            </DialogHeader>

            {state.matched.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Matched Courses</h4>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => dispatch({ type: "TOGGLE_ALL" })}
                      className="rounded"
                    />
                    Select all
                  </label>
                </div>
                <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                  {state.matched.map((course) => (
                    <label
                      key={course.courseId}
                      className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer ${
                        !course.isPassingGrade ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={state.selectedIds.has(course.courseId)}
                        disabled={!course.isPassingGrade}
                        onChange={() => dispatch({ type: "TOGGLE_COURSE", courseId: course.courseId })}
                        className="rounded"
                      />
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${
                        course.isPassingGrade ? "text-green-500" : "text-muted-foreground"
                      }`} />
                      <span className="font-mono text-xs text-muted-foreground w-20">{course.code}</span>
                      <span className="truncate flex-1">{course.title}</span>
                      <span className="text-xs text-muted-foreground">{course.credits}cr</span>
                      <Badge variant={course.isPassingGrade ? "secondary" : "outline"} className="text-xs">
                        {course.grade}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {state.unmatched.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Unmatched Courses</h4>
                <div className="border rounded-md divide-y">
                  {state.unmatched.map((course, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-mono text-xs w-20">{course.subjectCode} {course.number}</span>
                      <span className="flex-1 text-xs">Not found in catalog</span>
                      <Badge variant="outline" className="text-xs">{course.grade}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </p>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{state.selectedIds.size} courses selected ({selectedCredits} credits)</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => dispatch({ type: "GO_BACK" })} disabled={state.importing}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={state.importing || state.selectedIds.size === 0}
              >
                {state.importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {state.selectedIds.size} Courses
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
