---
title: "Sprint 4: Progress Tracking and Validation"
type: feat
date: 2026-04-01
revised: true
deepened: 2026-04-02
review-feedback: Simplicity reviewer — cut progress dashboard, simplify credit summary
research-grounded: true
dependencies: Sprint 3 (working planner with courses in semesters)
---

## Enhancement Summary

**Deepened on:** 2026-04-02
**Sections enhanced:** 6 (types, prerequisiteCheck, validateSemesters, creditSummary, prereq badges, credit sidebar)
**Research sources:** repo-research-analyst, learnings-researcher, spec-flow-analyzer, architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle, security-sentinel, pattern-recognition-specialist, Context7 (Vitest, Next.js, Supabase docs)

### Key Improvements from Research

1. **Credits column bug discovered and addressed** — DB has `credits_min`/`credits_max` but no `credits`. Existing Sprint 3 code silently gets `null`. Generated column migration added to pre-sprint fix.
2. **Corequisite handling clarified** — `validateSemesters` builds two sets per semester: prior-only for regular prereqs and prior+current for corequisites. `prerequisiteCheck` partitions rules internally.
3. **`TERM_ORDER` duplication flagged** — `planner-grid.tsx:8` duplicates the shared constant. Sprint 4 removes it.
4. **Guest mode prereq data loading specified** — New client-side `fetchPrereqRules()` function needed. `course_prerequisites` already has anon read RLS.
5. **`totalRequired` null handling defined** — Sidebar shows "X credits planned" only when no program is associated (default state for all current plans).
6. **PrereqWarning.missing enriched** — Includes both `courseId` and `courseCode` to avoid UUID-to-code mapping in UI layer.

### Critical Edge Cases from SpecFlow Analysis

- Freetext-only prereqs (`prerequisiteCourseId === null` for all rules) → treated as met
- Regular prereq in same semester → warning (must be prior semester)
- Corequisite in same semester → no warning
- Over-planned credits (130/120) → `remaining = 0`, not negative
- Plans with no program → credit sidebar shows planned only, no progress bar
- Prereq courses not in plan → secondary lookup needed for course codes in tooltip

# Sprint 4: Progress Tracking and Validation

## Review Feedback Applied

- **Cut entire Progress Dashboard** (`/progress/[id]` page) — `computeProgress` requires reliable `requirement_items` tree data which may be incomplete from Coursedog seeding. Defer until requirement tree data quality is validated. Removes 7 files (~200-250 LOC).
- **Cut `computeProgress` function** — the recursive tree-walking algorithm with "greedy claim set" is premature.
- **Cut `RequirementNode`, `GroupProgress`, `ProgressResult` types** — dead without `computeProgress`.
- **Cut `buildRequirementTree` utility** — only consumer was the removed progress page.
- **Merged `semesterValidate` into `prerequisite-check.ts`** — 5 lines of loop logic, not worth its own file.
- **Simplified `creditSummary`** — no past/future split (no completion tracking yet). Just `planned` + `remaining`. Drop `currentTerm` parameter.
- **Trimmed `PrereqRule` type** — only fields `prerequisiteCheck` actually reads (5 fields, not 9).
- **Reuse Sprint 2/3 types** — don't create parallel `PlanCourse`/`PlanSemester`/`DegreePlan` types. Import from shared or use existing `SemesterData`.
- **Flat array for warnings** — not nested `Map<Map>`. Components filter with `.filter()`.
- **~35-40% LOC reduction**, 7 files removed, 2 merged

**Revised Sprint 4 scope:** Two pure functions (`prerequisiteCheck`, `creditSummary`), prereq warning badges on planner, credit sidebar. No progress dashboard page.

---

## Overview

Add prerequisite validation and credit tracking to MajorMap. The `@major-map/planner` package (currently a stub) gets real pure-function logic that validates prerequisites and summarizes credits. The web app gets prereq warning badges on course cards and a credit summary sidebar on the planner page.

All computation lives in `@major-map/planner` as pure functions with no database or framework dependency. The same code runs identically in the browser (guest mode) and on the server (authenticated mode).

## Dependencies

- **Sprint 3 complete:** Working planner UI with courses in semesters, semester CRUD, plan persistence.
- **Database tables from Sprint 1:** `courses`, `course_prerequisites`.
- **Existing types/constants from shared:** `TERM_ORDER`, `Term`, `TERMS`.

## Pre-Sprint Fix: `credits` Column Bug

**Bug:** The `courses` table has `credits_min` and `credits_max` (both `numeric(3,1)`) but no single `credits` column. Sprint 3 code queries `courses.credits` in three places and gets `null`:

- `apps/web/src/app/plans/[id]/page.tsx:42` — `courses(code, title, credits)`
- `apps/web/src/app/plans/[id]/add-course.tsx` — `select("id, code, title, credits")`
- `apps/web/src/lib/course-lookup.ts` — `select("id, code, title, credits")`

**Fix:** Add a generated column to the `courses` table:

```sql
-- supabase/migrations/2026MMDD_add_credits_column.sql
ALTER TABLE courses ADD COLUMN credits numeric(3,1)
  GENERATED ALWAYS AS (credits_min) STORED;
```

Using `credits_min` as the conservative default. Variable-credit courses (where `credits_min != credits_max`) will show the minimum. A per-plan-course credit override can be added in a future sprint if needed.

This migration must run before Sprint 4 work begins so `creditSummary` operates on real data.

---

## Technical Approach

### Phase 1: Planner Package — Core Computation Engine

Replace the current stub (`helloPlanner`) with two pure functions plus a thin validation loop. Each takes plain data in and returns plain results. No side effects, no DB calls, no React imports.

#### 1.1 Input/Output Types

Define minimal types the functions need. Reuse `TERM_ORDER` from `@major-map/shared` for semester ordering.

```typescript
// packages/planner/src/types.ts

/** A prerequisite rule for a course (trimmed to 5 fields used by prerequisiteCheck). */
export interface PrereqRule {
  courseId: string;
  prerequisiteCourseId: string | null;
  groupId: string;
  groupOperator: "AND" | "OR";
  isCorequisite: boolean;
}

/** Result of a prerequisite check for a single course. */
export interface PrereqResult {
  met: boolean;
  missing: string[]; // course IDs (UUIDs) of unmet prerequisites
}

/** A prerequisite warning for display. */
export interface PrereqWarning {
  courseId: string;
  courseCode: string; // human-readable, e.g. "CS 2420"
  missing: Array<{ courseId: string; courseCode: string }>; // missing prereqs with display info
}

/** A course in a plan semester (matches existing SemesterData.courses shape). */
export interface PlanCourse {
  courseId: string;
  code: string;
  credits: number;
}

/** A semester in a plan (matches existing SemesterData shape). */
export interface PlanSemester {
  id: string;
  term: string;
  year: number;
  courses: PlanCourse[];
}

/** Credit summary for a plan. */
export interface CreditSummary {
  planned: number;      // total credits across all semesters
  remaining: number;    // max(0, totalRequired - planned)
  totalRequired: number;
}
```

**File:** `packages/planner/src/types.ts` (new)

**Design decisions:**
- `PrereqRule` has only the 5 fields `prerequisiteCheck` reads. No `condition`, `minGrade`, `descriptionOverride`.
- `PrereqWarning.missing` includes both `courseId` and `courseCode` so the UI can display human-readable text. The validation loop is responsible for the mapping.
- `PlanCourse` and `PlanSemester` mirror the existing `SemesterData` shape from `planner-grid.tsx` to avoid type conversion overhead.
- `CreditSummary` has no `completed` field — there is no completion tracking in Sprint 4. Just `planned` + `remaining`.

#### 1.2 `prerequisiteCheck(courseId, completedCourseIds, prereqRules)`

Checks whether a single course's prerequisites are satisfied.

```typescript
// packages/planner/src/prerequisite-check.ts

export function prerequisiteCheck(
  courseId: string,
  completedCourseIds: Set<string>,
  prereqRules: PrereqRule[],
): PrereqResult;
```

**Logic:**

1. Filter `prereqRules` to those matching `courseId`.
2. If no rules remain, return `{ met: true, missing: [] }`.
3. Group rules by `groupId`.
4. For each group, evaluate based on `groupOperator`:
   - `AND`: all `prerequisiteCourseId` values must be in `completedCourseIds`.
   - `OR`: at least one `prerequisiteCourseId` must be in `completedCourseIds`.
5. Rules with `prerequisiteCourseId === null` are skipped (freetext prereqs, not machine-checkable).
6. All groups must pass for `met: true`.
7. `missing` collects the UUIDs of unmet prerequisites across all failing groups.

**Corequisite handling:** The caller (validation loop) is responsible for including same-semester courses in `completedCourseIds` when appropriate. `prerequisiteCheck` itself does not distinguish corequisites — it just checks against the set it receives. The validation loop builds two sets: prior-only for regular prereqs and prior+current for corequisites, and calls `prerequisiteCheck` accordingly. See section 1.3.

**Tests:** (`packages/planner/src/prerequisite-check.test.ts`)

- Course with no prereq rules → `{ met: true, missing: [] }`.
- AND group: all met → met; one missing → not met with the missing ID.
- OR group: one met → met; none met → not met with all IDs in the group.
- Mixed: one AND group + one OR group, partial completion.
- Freetext-only prereq (`prerequisiteCourseId === null`) → met (skipped).
- All rules are freetext → met.
- Multiple groups: all groups must pass independently.

#### 1.3 `validateSemesters(semesters, prereqRules, courseCodeMap)`

Thin loop that validates all courses across all semesters. Lives in the same file as `prerequisiteCheck`.

```typescript
// packages/planner/src/prerequisite-check.ts

export function validateSemesters(
  semesters: PlanSemester[],
  prereqRules: PrereqRule[],
  courseCodeMap: Map<string, string>, // courseId → code (e.g. "CS 2420")
): PrereqWarning[];
```

**Logic:**

1. Sort semesters by year then `TERM_ORDER` (imported from `@major-map/shared`).
2. Build a running `completedCourseIds` set (courses from all prior semesters).
3. For each semester, for each course:
   a. Partition the course's prereq rules into regular (`isCorequisite: false`) and corequisite (`isCorequisite: true`).
   b. Check regular prereqs against `completedCourseIds` (prior semesters only).
   c. Check corequisite prereqs against `completedCourseIds ∪ currentSemesterCourseIds` (prior + same semester).
   d. Merge missing from both checks.
   e. If anything is missing, produce a `PrereqWarning` with course codes from `courseCodeMap`.
4. After processing a semester, add its courses to `completedCourseIds`.
5. Return flat array of all warnings.

**Tests:** (`packages/planner/src/prerequisite-check.test.ts`, same file)

- Semester with no prereq issues → `[]`.
- Course missing a prereq → warning with the missing code.
- Corequisite in same semester → no warning.
- Regular prereq in same semester → warning (must be in a prior semester).
- Multiple courses with issues → multiple warnings.
- First semester never has prereq warnings (no prior semesters, nothing to violate).

#### 1.4 `creditSummary(semesters, totalRequired)`

Computes a credit breakdown.

```typescript
// packages/planner/src/credit-summary.ts

export function creditSummary(
  semesters: PlanSemester[],
  totalRequired: number,
): CreditSummary;
```

**Logic:**

1. `planned` = sum of `course.credits` for all courses in all semesters.
2. `remaining` = `max(0, totalRequired - planned)`.
3. Return `{ planned, remaining, totalRequired }`.

No past/future split. No `currentTerm` parameter. Just total planned vs required.

**Tests:** (`packages/planner/src/credit-summary.test.ts`)

- 30 planned, 120 required → `{ planned: 30, remaining: 90, totalRequired: 120 }`.
- All credits planned (120/120) → `{ planned: 120, remaining: 0, totalRequired: 120 }`.
- Over-planned (130/120) → remaining = 0, not negative.
- Empty plan (0 semesters) → `{ planned: 0, remaining: 120, totalRequired: 120 }`.
- Fractional credits (courses with 0.5 credit increments) are summed correctly.

#### Research Insights — Pure Functions & Testing

**Best Practices (from Vitest docs, architecture review):**
- Use `describe` blocks to group tests by function, and nest by scenario (AND group, OR group, mixed)
- Test with `Set` objects directly — Vitest handles `Set` equality in `toEqual` comparisons
- Use `expectTypeOf` from Vitest to add compile-time type regression tests for public API
- Keep test data as small inline objects, not loaded from fixture files — these functions operate on tiny arrays

**Performance (from performance review):**
- `prerequisiteCheck` on 50 rules with 5 groups: ~0.01ms. Well under the 1ms target.
- `creditSummary` on 8 semesters with 40 courses: ~0.001ms. Trivial arithmetic.
- No memoization needed at the function level — the data is already small.

**Edge Cases (from SpecFlow analysis):**
- Group with zero rules after filtering out freetext → treat as passed (vacuously true)
- `completedCourseIds` as empty Set → all prerequisite checks fail (except freetext-only courses)
- Course that is its own prerequisite (data error) → should not cause infinite loop. Filter `courseId === prerequisiteCourseId` out.
- `credits` value of `0` for a course (e.g., seminar) → valid, include in sum

**Supabase Query Patterns (from Context7 docs):**
- `.in("course_id", courseIds)` is the correct pattern for batch prereq fetching
- Supabase `.in()` maps to PostgreSQL `ANY(ARRAY[...])` which uses the index on `course_id`
- For empty arrays, guard with `courseIds.length > 0` check (matches existing pattern in `page.tsx:39`)

#### 1.5 Package Barrel Export

```typescript
// packages/planner/src/index.ts
export { prerequisiteCheck, validateSemesters } from "./prerequisite-check.js";
export { creditSummary } from "./credit-summary.js";
export type * from "./types.js";
```

Remove the existing `helloPlanner` stub and its test.

#### 1.6 Package Updates

Update `packages/planner/package.json`:
- Change test script from `"echo ok"` to `"vitest run"` (or verify root vitest config picks up these test files).

**Files changed in Phase 1:**

- Delete: `packages/planner/src/index.test.ts` (stub test)
- Edit: `packages/planner/src/index.ts` (replace stub with barrel exports)
- Edit: `packages/planner/package.json` (fix test script)
- New: `packages/planner/src/types.ts`
- New: `packages/planner/src/prerequisite-check.ts` + `prerequisite-check.test.ts`
- New: `packages/planner/src/credit-summary.ts` + `credit-summary.test.ts`

#### Research Insights — Package Setup

**Vitest Configuration (verified):**
- Root `pnpm test` runs `vitest run` which scans all `**/*.test.ts` files across packages. The package-level `test` script in `packages/planner/package.json` currently says `"echo ok"` — change to `"vitest run"` for consistency.
- Vitest workspace config at root handles multi-package monorepo. No additional vitest config needed in the planner package.

---

### Phase 2: Prereq Warning Badges on Planner Page

#### 2.1 Data Loading — Prereq Rules Query

The planner page server component (`/plans/[id]/page.tsx`) already loads plan semesters and courses. Add a query to fetch prerequisite rules for all courses in the plan.

```typescript
// apps/web/src/app/plans/[id]/page.tsx (added to existing server component)

// After fetching courses, extract all courseIds:
const allCourseIds = (courses ?? []).map((c) => c.course_id);

// Fetch prereq rules for these courses:
const { data: prereqRules } = allCourseIds.length > 0
  ? await supabase
      .from("course_prerequisites")
      .select("course_id, prerequisite_course_id, group_id, group_operator, is_corequisite")
      .in("course_id", allCourseIds)
  : { data: [] };

// Also fetch course codes for prerequisite courses not already in the plan:
const prereqCourseIds = (prereqRules ?? [])
  .map((r) => r.prerequisite_course_id)
  .filter((id): id is string => id !== null && !allCourseIds.includes(id));

const { data: prereqCourses } = prereqCourseIds.length > 0
  ? await supabase
      .from("courses")
      .select("id, code")
      .in("id", prereqCourseIds)
  : { data: [] };

// Build courseCodeMap from plan courses + prereq courses
```

For the **guest planner**, a similar client-side fetch is needed using the browser Supabase client (`course_prerequisites` has anon read access via RLS).

#### 2.2 Warnings Computation

Compute warnings server-side (authenticated) or client-side (guest) using `validateSemesters` from `@major-map/planner`. Pass the result as a prop to the planner grid.

```typescript
// In the server component or guest planner:
import { validateSemesters } from "@major-map/planner";

const warnings = validateSemesters(semesterData, formattedPrereqRules, courseCodeMap);
```

Pass `warnings: PrereqWarning[]` as a prop through `AuthenticatedPlanner` → `PlannerGrid` → `SemesterCard`.

#### 2.3 Warning Badge on Course Cards

Add a yellow/amber badge to course list items in `semester-card.tsx` when a warning exists.

```tsx
// apps/web/src/app/plans/[id]/semester-card.tsx (modified)
// On each course <li>, check if warnings array includes this courseId.
// If yes, render:
//   <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
//     ⚠ Missing: {warning.missing.map(m => m.courseCode).join(", ")}
//   </Badge>
```

**Design decisions:**
- Soft warning only: amber badge, no blocking. User can leave the course in place.
- No modal or confirmation dialog. A badge with inline text is sufficient.
- Badge disappears when the user adds the missing prereq to an earlier semester (server refresh recomputes warnings).
- Uses existing `Badge` component from `apps/web/src/components/ui/badge.tsx`.

**Files changed in Phase 2:**

- Edit: `apps/web/src/app/plans/[id]/page.tsx` (add prereq query, compute warnings, pass as prop)
- Edit: `apps/web/src/app/plans/[id]/authenticated-planner.tsx` (pass warnings through)
- Edit: `apps/web/src/app/plans/[id]/planner-grid.tsx` (accept warnings prop, pass to semester cards)
- Edit: `apps/web/src/app/plans/[id]/semester-card.tsx` (render warning badges)
- Edit: `apps/web/src/app/plans/guest-planner.tsx` (client-side prereq fetch + warnings)

#### Research Insights — Prereq Badge Implementation

**Existing Components (from repo research):**
- `Badge` component at `apps/web/src/components/ui/badge.tsx` — has `default`, `secondary`, `destructive`, `outline` variants. Use `outline` with amber styling.
- Warning badge placement: inside the `<li>` at `semester-card.tsx:44-58`, below the course title `<p>`.
- Pattern: filter warnings array with `warnings.filter(w => w.courseId === course.courseId)` at the SemesterCard level.

**Guest Mode Data Loading (from SpecFlow analysis):**
- Guest planner needs a new `fetchPrereqRules(courseIds: string[])` function in `apps/web/src/lib/course-lookup.ts` (or a new file).
- `course_prerequisites` table has anon read RLS — client-side query will work.
- Must also fetch course codes for prerequisite courses NOT in the plan (for tooltip display).
- Pattern: after fetching prereq rules, collect all `prerequisite_course_id` values not in the existing `courseMap`, then call `fetchCoursesByIds()` for those.

**Next.js Server Component Data Passing (from Context7):**
- Server component fetches and computes warnings, passes flat `PrereqWarning[]` as a serializable prop to `AuthenticatedPlanner`.
- This is the correct Next.js pattern — confirmed by official docs: "Pass serializable data from Server Component to Client Component using props."
- `PrereqWarning[]` is fully serializable (plain objects, strings, arrays).

---

### Phase 3: Credit Summary Sidebar

#### 3.1 Credit Computation

Use `creditSummary` from `@major-map/planner` in the server component. `totalRequired` comes from `programs.total_credits` for the plan's `program_id`.

```typescript
// In page.tsx server component:
import { creditSummary } from "@major-map/planner";

// Fetch program total_credits if program_id exists
let totalRequired: number | null = null;
if (plan.program_id) {
  const { data: program } = await supabase
    .from("programs")
    .select("total_credits")
    .eq("id", plan.program_id)
    .single();
  totalRequired = program?.total_credits ?? null;
}

const credits = totalRequired !== null
  ? creditSummary(semesterData, totalRequired)
  : null;
```

**When `totalRequired` is null** (no program associated or program has no total): the sidebar shows only "X credits planned" with no remaining/progress bar. This is acceptable for Sprint 4 since neither guest nor authenticated plans have a program picker yet.

#### 3.2 Sidebar Component

```tsx
// apps/web/src/app/plans/[id]/credit-sidebar.tsx (new, colocated with planner)

// Compact sidebar displayed alongside the semester grid.
// When credits data is available (totalRequired known):
//   - "X / Y credits planned" with a progress bar
//   - "Z credits remaining" below
// When credits data is unavailable (no program):
//   - "X credits planned" (no progress bar)
// Uses Tailwind for styling, no new dependencies.
```

**Layout change:** The planner page layout changes from single-column to a two-column layout:

```tsx
// apps/web/src/app/plans/[id]/page.tsx (layout section)
<div className="flex flex-col gap-6 lg:flex-row">
  <div className="flex-1 min-w-0">
    <AuthenticatedPlanner ... />
  </div>
  <aside className="lg:w-64 shrink-0">
    <CreditSidebar credits={credits} totalPlanned={totalPlannedCredits} />
  </aside>
</div>
```

On mobile (`< lg`), the sidebar stacks above the grid as a compact summary bar.

**Files changed in Phase 3:**

- New: `apps/web/src/app/plans/[id]/credit-sidebar.tsx`
- Edit: `apps/web/src/app/plans/[id]/page.tsx` (add program query, compute credits, two-column layout)
- Edit: `apps/web/src/app/plans/guest-planner.tsx` (add credit sidebar for guest mode)

#### Research Insights — Credit Sidebar & Layout

**Layout Change (from architecture review):**
- Current layout is single-column: `<main>` → `<AuthenticatedPlanner>` → `<PlannerGrid>`.
- New layout: `flex flex-col lg:flex-row` with `flex-1 min-w-0` for main content and `lg:w-64 shrink-0` for sidebar.
- The existing `PlannerGrid` grid columns (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) will naturally adjust within the narrower flex child.
- On mobile (`< lg`), sidebar stacks above the grid. Use `order-first lg:order-none` on the sidebar so it appears at top on mobile.

**Security (from security review):**
- `programs.total_credits` query uses RLS. The server component already has the user's session.
- No sensitive data exposed — credit counts and program totals are public catalog data.
- The `program_id` UUID in the query comes from the user's own plan row (already RLS-protected).

**Pattern Consistency (from pattern review):**
- The sidebar component should be colocated in the route directory (`apps/web/src/app/plans/[id]/credit-sidebar.tsx`), not in a separate `components/` directory — matching the existing pattern.
- Use `"use client"` only if the sidebar needs interactivity. If it's purely display, it can remain a server component. Since `creditSummary` is computed server-side, the sidebar can be a server component.

---

## What This Sprint Does NOT Include

- **Progress dashboard** (`/progress/[id]`) — cut by reviewer, deferred.
- **`computeProgress` function** — cut, requires reliable requirement tree data.
- **Blocking prerequisite enforcement** — warnings are soft (amber badges). No drag-and-drop rejection.
- **Grade tracking** — `minGrade` is stored in DB but not checked. No grade input.
- **Program picker** — neither guest nor authenticated plans can select a program yet. Credit sidebar shows "X planned" only until a program is associated.
- **Charts library** — progress bar uses Tailwind CSS, not a charting library.
- **Elective recommendation engine** — out of scope.
- **Multi-program progress** — one program per plan.

---

## File Summary

### New Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/2026MMDD_add_credits_column.sql` | Generated `credits` column from `credits_min` |
| `packages/planner/src/types.ts` | Input/output types for planner functions |
| `packages/planner/src/prerequisite-check.ts` | `prerequisiteCheck` + `validateSemesters` pure functions |
| `packages/planner/src/prerequisite-check.test.ts` | Tests for prerequisite checking and semester validation |
| `packages/planner/src/credit-summary.ts` | `creditSummary` pure function |
| `packages/planner/src/credit-summary.test.ts` | Tests for credit summary |
| `apps/web/src/app/plans/[id]/credit-sidebar.tsx` | Credit summary sidebar component |

### Edited Files

| File | Change |
| --- | --- |
| `packages/planner/src/index.ts` | Replace `helloPlanner` stub with barrel exports |
| `packages/planner/package.json` | Fix test script |
| `apps/web/src/app/plans/[id]/page.tsx` | Fetch prereq rules + program, compute warnings/credits, two-column layout |
| `apps/web/src/app/plans/[id]/authenticated-planner.tsx` | Pass warnings prop through |
| `apps/web/src/app/plans/[id]/planner-grid.tsx` | Accept warnings prop, pass to semester cards, import `TERM_ORDER` from shared |
| `apps/web/src/app/plans/[id]/semester-card.tsx` | Render prereq warning badges |
| `apps/web/src/app/plans/guest-planner.tsx` | Client-side prereq fetch + warnings + credit sidebar |

### Deleted Files

| File | Reason |
| --- | --- |
| `packages/planner/src/index.test.ts` | Stub test for `helloPlanner`, no longer needed |

---

## Acceptance Criteria

### Functional

- [ ] `pnpm -r build` succeeds (planner package compiles)
- [ ] `pnpm test` passes (all planner pure function tests green)
- [ ] `prerequisiteCheck` correctly evaluates AND groups, OR groups, and freetext rules
- [ ] `validateSemesters` returns warnings only for courses with unmet prereqs
- [ ] `validateSemesters` treats corequisites as met when the coreq is in the same semester
- [ ] `validateSemesters` does NOT treat regular prereqs as met from the same semester
- [ ] `creditSummary` returns correct planned/remaining split
- [ ] Prereq warning badges appear on planner course cards when prerequisites are missing
- [ ] Badges disappear when missing prereqs are added to earlier semesters
- [ ] Credit summary sidebar shows correct numbers on the planner page
- [ ] Credit sidebar shows "X credits planned" without progress bar when no program is associated
- [ ] All features work in both authenticated mode and guest mode

### Non-Functional

- [ ] Planner package has zero runtime dependencies beyond `@major-map/shared`
- [ ] All planner functions are pure (no side effects, no DB calls, no DOM access)
- [ ] Planner functions execute in < 1ms for a typical plan (8 semesters, 40 courses)
- [ ] No new npm dependencies added to the web app

### Quality Gates

- [ ] `prerequisiteCheck` has at least 7 unit tests (happy path, AND, OR, mixed, freetext, empty)
- [ ] `validateSemesters` has at least 5 unit tests (no issues, missing, corequisite, multiple)
- [ ] `creditSummary` has at least 5 unit tests (normal, full, over, empty, fractional)
- [ ] No TypeScript `any` in planner package
- [ ] `credits` generated column migration runs successfully
