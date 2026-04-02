---
title: "Sprint 5: Transcript Import"
type: feat
date: 2026-04-02
dependencies: "Sprint 4 (progress engine)"
---

# Sprint 5: Transcript Import

## Enhancement Summary

**Deepened on:** 2026-04-02
**Sections enhanced:** 10
**Agents used:** architecture-strategist, security-sentinel, performance-oracle, data-integrity-guardian, data-migration-expert, kieran-typescript-reviewer, code-simplicity-reviewer, julik-frontend-races-reviewer, pattern-recognition-specialist, framework-docs-researcher, best-practices-researcher

### Key Improvements

1. **Parser moved to `packages/planner`** — catalog is the Coursedog pipeline; planner is pure computation. Web app already depends on planner, not catalog.
2. **ReDoS-safe parsing** — two-pass approach (split on 2+ whitespace, then validate fields) instead of single complex regex.
3. **Simplified to 2 steps** — paste → preview-with-import (dropped separate confirm step). API route replaced with Server Action.
4. **Single-query matching** — leverage existing generated `code` column with `.in("code", codes)` instead of N queries.
5. **Grade enum + DB constraints** — typed grade values, table-level CHECK linking status↔grade consistency.

---

## Overview

Students paste an unofficial UofU transcript to auto-mark completed courses. The parser extracts course codes, grades, and credits from plain text, matches them against the `courses` table, and marks matched courses as completed in the student's plan. Completed courses are visually distinguished in the planner.

## Problem Statement / Motivation

Students manually add courses they have already completed, which is tedious and error-prone. Transcript import lets them bootstrap their plan in seconds, accurately reflecting what they have already taken. This also enables prerequisite validation to correctly handle completed courses.

## Design Decisions

### D1: Semester Placement — "Prior Coursework" Semester

Completed courses are placed into an auto-created **"Prior Coursework"** semester at `(term='Fall', year=2020)` — the earliest allowed position. This ensures:

- `validateSemesters` sees completed courses before all planned semesters (prereqs satisfied)
- No complex term header parsing needed for MVP
- Clean UX: a single "Prior Coursework" card at the start of the grid

If the semester already exists (re-import), reuse it.

> **Research Insight (data-integrity):** Use `INSERT ... ON CONFLICT (plan_id, term, year) DO NOTHING RETURNING id` or Supabase `.upsert()` for the semester find-or-create to avoid race conditions on concurrent imports.

### D2: Grade Classification

| Category | Grades | Import behavior |
|----------|--------|-----------------|
| Completed | A, A-, B+, B, B-, C+, C, C-, D+, D, D-, CR, P, S | Pre-checked in preview |
| Not completed | W, I, E, NC, NP, U | Shown in preview, unchecked, cannot be imported |

UofU uses **E** (not F) for failing. E/W/I are shown but not selectable.

> **Research Insight (typescript):** Define grades as a TypeScript `const` enum for type safety:
> ```typescript
> const PASSING_GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "CR", "P", "S"] as const;
> const FAILING_GRADES = ["W", "I", "E", "NC", "NP", "U"] as const;
> const ALL_GRADES = [...PASSING_GRADES, ...FAILING_GRADES] as const;
> export const GradeSchema = z.enum(ALL_GRADES);
> export type Grade = z.infer<typeof GradeSchema>;
> export const PASSING_GRADE_SET = new Set<string>(PASSING_GRADES);
> ```

### D3: Completion is Plan-Scoped

Completion lives in `plan_courses` (with new `status` and `grade` columns). Each plan has its own completion state. Matches the existing schema; avoids a new table.

### D4: Re-Import is Additive Only

Re-importing never removes previously completed courses. Upsert updates grades if changed. New courses are added. This prevents accidental data loss.

### D5: University — Hardcode UofU

Only one university exists. Matcher queries courses by `subject_code + number` without a university filter. When multi-university is added, plumb `university_id` through the program association.

### D6: Server Actions for Everything

~~The transcript parse step uses an API route.~~ **Revised:** Both parse and import use Server Actions. The codebase uses Server Actions exclusively for all server-side calls. A separate API route breaks pattern consistency for no benefit — Server Actions can return preview data without mutating state.

> **Research Insight (simplicity):** A Server Action `parseTranscript(text)` returns preview data; a second `importTranscriptCourses(planId, courses[])` handles the mutation. Both live in `actions.ts`. This eliminates the API route file, its test file, and the route directory.

### D7: Cross-Listed Courses — Exact Match Only

Sprint 5 matches `subject_code + number` exactly. Cross-listed course matching via `course_group_id` is deferred to a future sprint.

---

## Technical Approach

### Phase 1: Database Migration

Add `status` and `grade` columns to `plan_courses` with constraints.

```sql
-- supabase/migrations/20260402000001_add_status_grade_to_plan_courses.sql
ALTER TABLE public.plan_courses
  ADD COLUMN status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed')),
  ADD COLUMN grade text
    CHECK (grade IN ('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','CR','NC','NP','P','S','U','W','I'));

-- Enforce: planned courses have no grade, completed courses always have one
ALTER TABLE public.plan_courses
  ADD CONSTRAINT chk_status_grade_consistency
    CHECK (
      (status = 'planned' AND grade IS NULL)
      OR (status = 'completed' AND grade IS NOT NULL)
    );
```

No backfill needed — all existing rows default to `'planned'` with `NULL` grade.

> **Research Insight (migration):** On PG11+, `ADD COLUMN ... NOT NULL DEFAULT <constant>` is metadata-only (no table rewrite). The CHECK constraint requires a table scan, but the table is tiny (~hundreds of rows). Safe to run as a single ALTER. Rollback: `ALTER TABLE plan_courses DROP COLUMN status, DROP COLUMN grade;`

> **Research Insight (data-integrity):** The table-level `chk_status_grade_consistency` constraint prevents orphaned states: no completed courses without grades, no planned courses with grades.

**File:** `supabase/migrations/20260402000001_add_status_grade_to_plan_courses.sql` (new)

### Phase 2: Transcript Parser (Pure Function)

Create a parser in **`packages/planner`** (not catalog — the parser is pure computation with no DB/API dependencies, and the web app already depends on planner).

```typescript
// packages/planner/src/transcript/parser.ts
import { z } from "zod";

const PASSING_GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "CR", "P", "S"] as const;
const FAILING_GRADES = ["W", "I", "E", "NC", "NP", "U"] as const;
const ALL_GRADES = [...PASSING_GRADES, ...FAILING_GRADES] as const;

export const GradeSchema = z.enum(ALL_GRADES);
export type Grade = z.infer<typeof GradeSchema>;

export const PASSING_GRADE_SET = new Set<string>(PASSING_GRADES);

export const TranscriptCourseSchema = z.object({
  subjectCode: z.string().min(2).max(5),
  number: z.string().regex(/^\d{4}[A-Z]?$/),
  title: z.string().optional(),
  credits: z.number().min(0).max(12).multipleOf(0.5),
  grade: GradeSchema,
});

export type TranscriptCourse = z.infer<typeof TranscriptCourseSchema>;

export interface ParseResult {
  courses: TranscriptCourse[];
  totalCredits: number;
  skippedLines: number;
}

export function parseTranscript(text: string): ParseResult { /* ... */ }
```

> **Research Insight (security — ReDoS prevention):** Do NOT use a single complex regex. Use a two-pass approach to eliminate catastrophic backtracking:
> ```typescript
> function parseLine(line: string): TranscriptCourse | null {
>   const trimmed = line.trim();
>   if (!trimmed) return null;
>
>   // Split on 2+ whitespace characters (matches actual transcript formatting)
>   const fields = trimmed.split(/\s{2,}/);
>   if (fields.length < 4) return null;
>
>   // Validate each field individually with simple, non-backtracking patterns
>   const codeMatch = fields[0].match(/^([A-Z]{2,5})\s+(\d{4}[A-Z]?)$/);
>   if (!codeMatch) return null;
>
>   const title = fields.length === 5 ? fields[1] : undefined;
>   const creditsStr = fields.length === 5 ? fields[2] : fields[1];
>   const gradeStr = fields.length === 5 ? fields[3] : fields[2];
>
>   const credits = parseFloat(creditsStr);
>   if (isNaN(credits)) return null;
>
>   const gradeResult = GradeSchema.safeParse(gradeStr);
>   if (!gradeResult.success) return null;
>
>   return { subjectCode: codeMatch[1], number: codeMatch[2], title, credits, grade: gradeResult.data };
> }
> ```
> Also enforce a per-line length cap (500 chars) as defense-in-depth.

Parser behavior:
- Line-by-line scan, trim whitespace, skip blank/header/GPA lines
- For repeated courses (same subject+number), keep the entry with the highest grade
- Return `ParseResult` with extracted courses, total credits, and count of skipped lines
- Grade ranking for dedup: A > A- > B+ > B > ... > D- > E > CR > P > W > I

**File:** `packages/planner/src/transcript/parser.ts` (new)
**Test:** `packages/planner/src/transcript/parser.test.ts` (new)

### Phase 3: Parse + Match Server Action

A single Server Action that parses text, matches courses against DB, and returns preview data. No API route needed.

```typescript
// apps/web/src/app/plans/actions.ts (edit — add parseTranscript action)
"use server";

export async function parseTranscriptAction(text: string) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // Input validation
  if (typeof text !== "string" || text.length > 50_000) {
    return { error: "Invalid input" };
  }

  // 1. Parse (pure function from @major-map/planner)
  const { courses: parsed, skippedLines } = parseTranscript(text);

  // 2. Match — single query using the generated `code` column
  const codes = parsed.map(c => `${c.subjectCode} ${c.number}`);
  const { data: dbCourses } = await supabase
    .from("courses")
    .select("id, code, title, credits")
    .in("code", codes);

  // 3. Build matched/unmatched arrays
  const codeToDb = new Map(dbCourses?.map(c => [c.code, c]) ?? []);
  const matched = [];
  const unmatched = [];

  for (const pc of parsed) {
    const code = `${pc.subjectCode} ${pc.number}`;
    const db = codeToDb.get(code);
    if (db) {
      matched.push({
        courseId: db.id, code: db.code, title: db.title,
        credits: db.credits, grade: pc.grade,
        isPassingGrade: PASSING_GRADE_SET.has(pc.grade),
      });
    } else {
      unmatched.push({ subjectCode: pc.subjectCode, number: pc.number, grade: pc.grade });
    }
  }

  return { matched, unmatched, skippedLines, totalCredits: matched.reduce((s, c) => s + c.credits, 0) };
}
```

> **Research Insight (performance):** The `.in("code", codes)` approach leverages the existing generated `code` column and the `idx_courses_lookup` index. Single round trip instead of N queries. For 60 values against 5000 rows, Postgres uses a bitmap index scan — sub-millisecond.

**File:** `apps/web/src/app/plans/actions.ts` (edit)

### Phase 4: Import Server Action

On confirm, upsert `plan_courses` rows for matched courses.

```typescript
// apps/web/src/app/plans/actions.ts (edit — add importTranscriptCourses)
export async function importTranscriptCourses(
  planId: string,
  courses: Array<{ courseId: string; grade: string; credits: number }>,
) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // IDOR check: verify user owns this plan
  const { data: plan } = await supabase
    .from("semester_plans")
    .select("id")
    .eq("id", planId)
    .single();  // RLS ensures only owner's plan is returned
  if (!plan) return { error: "Plan not found" };

  // Validate all courseIds exist
  const courseIds = courses.map(c => c.courseId);
  const { data: validCourses } = await supabase
    .from("courses").select("id").in("id", courseIds);
  const validIds = new Set(validCourses?.map(c => c.id) ?? []);
  const invalid = courseIds.filter(id => !validIds.has(id));
  if (invalid.length > 0) return { error: `${invalid.length} course(s) not found in catalog` };

  // Find or create "Prior Coursework" semester
  const { data: existing } = await supabase
    .from("plan_semesters")
    .select("id")
    .eq("plan_id", planId)
    .eq("term", "Fall")
    .eq("year", 2020)
    .single();

  let semesterId: string;
  if (existing) {
    semesterId = existing.id;
  } else {
    const { data: newSem, error } = await supabase
      .from("plan_semesters")
      .insert({ plan_id: planId, user_id: user.id, term: "Fall", year: 2020 })
      .select("id")
      .single();
    if (error) return { error: error.message };
    semesterId = newSem.id;
  }

  // Upsert plan_courses with status='completed'
  const rows = courses.map(c => ({
    plan_semester_id: semesterId,
    user_id: user.id,
    course_id: c.courseId,
    status: "completed" as const,
    grade: c.grade,
  }));

  const { error: upsertError } = await supabase
    .from("plan_courses")
    .upsert(rows, { onConflict: "plan_semester_id,course_id" });

  if (upsertError) return { error: upsertError.message };

  revalidatePath("/plans");
  return { success: true, importedCount: rows.length };
}
```

> **Research Insight (security):** The plan ownership check via `supabase.from("semester_plans").select("id").eq("id", planId).single()` leverages RLS — if the user doesn't own the plan, the query returns null. This prevents IDOR attacks where a user submits another user's planId.

> **Research Insight (data-integrity):** Supabase `.upsert()` with `onConflict: "plan_semester_id,course_id"` correctly updates `status` and `grade` on conflict. The unique constraint `(plan_semester_id, course_id)` is the conflict target. Re-import updates grades if changed.

**File:** `apps/web/src/app/plans/actions.ts` (edit)

### Phase 5: Dialog UI Component

Add Radix dialog component (no dialog exists yet in the component library).

```bash
pnpm --filter @major-map/web add @radix-ui/react-dialog
```

Create `apps/web/src/components/ui/dialog.tsx` following the existing shadcn pattern. Use controlled `open`/`onOpenChange` props.

> **Research Insight (framework-docs):** Radix Dialog structure:
> ```tsx
> <Dialog.Root open={open} onOpenChange={setOpen}>
>   <Dialog.Portal>
>     <Dialog.Overlay className="fixed inset-0 bg-black/50" />
>     <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ...">
>       <Dialog.Title>Import Transcript</Dialog.Title>
>       <Dialog.Description>Paste your unofficial transcript below.</Dialog.Description>
>       {children}
>       <Dialog.Close aria-label="Close">×</Dialog.Close>
>     </Dialog.Content>
>   </Dialog.Portal>
> </Dialog.Root>
> ```
> Accessibility: focus trap is automatic, `Dialog.Title` and `Dialog.Description` are required for screen readers.

**File:** `apps/web/src/components/ui/dialog.tsx` (new)

### Phase 6: Import UI — Two-Step Modal

~~Three steps~~ **Revised: Two steps** — **Paste → Preview (with inline import button)**.

The separate "confirm" step was pure ceremony. The preview step already shows exactly what will be imported. The "Import Selected" button on the preview IS the confirm.

```typescript
// apps/web/src/app/plans/[id]/transcript-import-modal.tsx
// Props: { planId: string; open: boolean; onOpenChange: (open: boolean) => void }
//
// State management: useReducer for complex state (step, loading, error, parseResult, selectedCourseIds)
//
// Step 1 — Paste:
//   Textarea with placeholder showing expected format
//   "Parse" button → calls parseTranscriptAction Server Action
//   AbortController: cancel previous parse if user re-pastes
//   Disable "Parse" button while loading (prevent double-submit)
//
// Step 2 — Preview + Import:
//   Table of matched courses (green checkmark, checkbox checked if passing grade)
//   Table of unmatched courses (gray, informational only, not selectable)
//   Non-passing grades (W, I, E) shown but disabled checkbox
//   "Select All / Deselect All" toggle
//   Course count + credit total summary
//   "Back" button (preserves textarea content) and "Import Selected" button
//   "Import Selected" disabled while loading, shows spinner
//   On success: close modal → router.refresh() → toast notification
```

> **Research Insight (frontend-races):**
> - Use `useReducer` instead of multiple `useState` calls — step transitions + loading + error + data is complex enough to warrant it
> - Disable all action buttons during async operations (parse, import) to prevent double-submit
> - AbortController for the parse call — if user pastes new text and clicks Parse again, abort the previous request
> - Close modal BEFORE `router.refresh()` to avoid flash of stale data — the refresh happens in background
> - Reset reducer state when modal opens (not when it closes — avoids flash during close animation)

> **Research Insight (simplicity):** Dropping the confirm step saves: one state value, one conditional render, one "Back" handler, one test case. The "Import Selected" button label is clear enough intent.

**File:** `apps/web/src/app/plans/[id]/transcript-import-modal.tsx` (new)
**Test:** `apps/web/src/app/plans/[id]/transcript-import-modal.test.tsx` (new)

### Phase 7: Visual Distinction for Completed Courses

Modify `semester-card.tsx` to render completed courses differently. Course rendering is inline in the semester card (lines 46–76).

Completed course styling:
- `bg-green-50 dark:bg-green-950/20` muted background
- `CheckCircle2` icon (from lucide-react) before the course code
- Grade badge displayed: `<Badge variant="secondary">A</Badge>`
- Remove button hidden (completed courses are locked)

The "Prior Coursework" semester card should look distinct from regular semesters:
- Different header label: "Prior Coursework" instead of "Fall 2020"
- Hide the "Add Course" button and "Remove Semester" button
- Muted card border

**File:** `apps/web/src/app/plans/[id]/semester-card.tsx` (edit)
**File:** `apps/web/src/app/plans/[id]/planner-grid.tsx` (edit — update SemesterData type)

### Phase 8: Trigger Button on Plan Page

Add "Import Transcript" button to the plan page header, next to the plan name. Only visible for authenticated users (guests never reach this page due to redirect).

**File:** `apps/web/src/app/plans/[id]/page.tsx` (edit)

### Phase 9: Update Planner Types

Extend `PlanCourse` in the planner package to include `status` and `grade`.

```typescript
// packages/planner/src/types.ts (edit)
export interface PlanCourse {
  courseId: string;
  code: string;
  credits: number;
  status?: "planned" | "completed";  // optional for backwards compat
  grade?: string;                     // optional
}
```

> **Research Insight (typescript):** Optional fields preserve backwards compatibility with existing tests. The `creditSummary` function should treat `status === undefined` as `"planned"` (existing rows before migration).

Update `creditSummary` to report completed vs. planned credits separately.

**File:** `packages/planner/src/types.ts` (edit)
**File:** `packages/planner/src/credit-summary.ts` (edit)
**File:** `packages/planner/src/credit-summary.test.ts` (edit)

---

## Acceptance Criteria

### Functional

- [x] Pasting a UofU unofficial transcript correctly parses course codes, grades, and credits
- [x] Parser handles: repeated courses (keeps highest grade), W courses, CR/P grades, empty input, malformed lines
- [x] Matched courses shown in preview with grade and match status
- [x] Non-passing grades (W, I, E) shown in preview but not selectable
- [x] Unmatched courses listed separately with clear messaging
- [x] Confirming import marks selected courses as completed in a "Prior Coursework" semester
- [x] Progress/credit sidebar updates to reflect newly completed courses
- [x] Completed courses visually distinct: green tint, checkmark icon, grade badge, remove button hidden
- [x] Re-importing is additive and idempotent (no duplicates, grades updated if changed)

### Non-Functional

- [x] Parser is a pure function with no DB or side-effect dependencies
- [x] Input capped at 50,000 characters with per-line cap at 500 characters
- [x] No ReDoS-vulnerable regex patterns (two-pass parsing approach)
- [x] Grade values constrained by CHECK constraint in DB and const enum in code
- [x] Plan ownership verified before import (IDOR prevention via RLS)
- [x] All new code has colocated test files
- [x] TDD: tests written before implementation

### Quality Gates

- [x] Parser unit tests: standard transcript, empty input, malformed lines, repeated courses, all grade types, ReDoS-safe (long lines don't hang)
- [x] Server Action tests: parse returns preview data, import upserts correctly, auth required, IDOR prevented
- [x] Component tests: modal open/close, step transitions, checkbox selection, double-submit prevention

---

## Files to Modify

### New Files

| File | Package | Purpose |
|------|---------|---------|
| `supabase/migrations/20260402000001_add_status_grade_to_plan_courses.sql` | — | Add status + grade columns with constraints |
| `packages/planner/src/transcript/parser.ts` | planner | Pure text parser + grade types |
| `packages/planner/src/transcript/parser.test.ts` | planner | Parser unit tests |
| `apps/web/src/components/ui/dialog.tsx` | web | Radix dialog wrapper |
| `apps/web/src/app/plans/[id]/transcript-import-modal.tsx` | web | Two-step import modal |
| `apps/web/src/app/plans/[id]/transcript-import-modal.test.tsx` | web | Modal component tests |
| `data/raw/fixtures/uofu-transcript-sample.txt` | — | Sample transcript for tests |

### Edited Files

| File | Change |
|------|--------|
| `apps/web/src/app/plans/actions.ts` | Add `parseTranscriptAction` + `importTranscriptCourses` server actions |
| `apps/web/src/app/plans/[id]/page.tsx` | Add Import Transcript button + modal |
| `apps/web/src/app/plans/[id]/semester-card.tsx` | Completed course styling + "Prior Coursework" variant |
| `apps/web/src/app/plans/[id]/planner-grid.tsx` | Update `SemesterData` type with status/grade |
| `packages/planner/src/types.ts` | Add status/grade to `PlanCourse` |
| `packages/planner/src/credit-summary.ts` | Split completed vs. planned credits |
| `packages/planner/src/credit-summary.test.ts` | Add completed course test cases |
| `packages/planner/src/index.ts` | Export transcript parser + grade types |
| `apps/web/package.json` | Add `@radix-ui/react-dialog` dependency |

---

## Implementation Order (TDD)

1. **Migration** — write SQL with constraints
2. **Fixture** — create sample transcript text in `data/raw/fixtures/`
3. **Parser tests** → parser implementation (in `packages/planner`)
4. **Server Action tests** → `parseTranscriptAction` + `importTranscriptCourses` (mocked Supabase)
5. **Dialog component** — add shadcn dialog
6. **Modal component tests** → modal implementation (two-step flow)
7. **Planner type updates** + credit summary tests → credit summary changes
8. **Semester card** — completed course styling + "Prior Coursework" variant
9. **Plan page** — button + modal wiring

---

## Deferred to Future Sprints

- Cross-listed course matching via `course_group_id`
- Term header parsing (placing courses in historically accurate semesters)
- Manual matching of unmatched courses
- User-scoped completion (shared across plans)
- Guest mode transcript import
- Drag-and-drop for completed courses
- Transcript file upload (PDF parsing)
