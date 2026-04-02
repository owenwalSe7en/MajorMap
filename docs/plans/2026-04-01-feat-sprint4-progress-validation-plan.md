---
title: "Sprint 4: Progress Tracking and Validation"
type: feat
date: 2026-04-01
revised: true
review-feedback: Simplicity reviewer — cut progress dashboard, simplify credit summary
dependencies: Sprint 3 (working planner with courses in semesters)
---

# Sprint 4: Progress Tracking and Validation

## Review Feedback Applied

- **Cut entire Progress Dashboard** (`/progress/[id]` page) — `computeProgress` requires reliable `requirement_items` tree data which may be incomplete from Coursedog seeding. Defer until requirement tree data quality is validated. Removes 7 files (~200-250 LOC).
- **Cut `computeProgress` function** — the recursive tree-walking algorithm with "greedy claim set" is premature. Credit summary sidebar already answers "how far along am I?" with simple numbers.
- **Cut `RequirementNode`, `GroupProgress`, `ProgressResult` types** — dead without `computeProgress`.
- **Cut `buildRequirementTree` utility** — only consumer was the removed progress page.
- **Merged `semesterValidate` into `prerequisite-check.ts`** — 5 lines of loop logic, not worth its own file.
- **Simplified `creditSummary`** — no past/future split (no completion tracking yet). Just `planned` + `remaining`. Drop `currentTerm` parameter.
- **Trimmed `PrereqRule` type** — only fields `prerequisiteCheck` actually reads (5 fields, not 9). `condition`, `minGrade`, `descriptionOverride` unused in Sprint 4.
- **Reuse Sprint 2/3 types** — don't create parallel `PlanCourse`/`PlanSemester`/`DegreePlan` types. Import from shared.
- **Flat array for warnings** — not nested `Map<Map>`. Components filter with `.filter()`.
- **~35-40% LOC reduction**, 7 files removed, 2 merged

**Revised Sprint 4 scope:** Two pure functions (`prerequisiteCheck`, `creditSummary`), prereq warning badges on planner, credit sidebar. No progress dashboard page.

## Overview

Add progress tracking and prerequisite validation to MajorMap. The `@major-map/planner` package (currently a stub) gets real pure-function logic that computes degree progress, validates prerequisites, and summarizes credits. The web app gets a progress dashboard page and visual indicators (prereq warning badges, credit summary sidebar) on the planner page.

All computation lives in `@major-map/planner` as pure functions with no database or framework dependency. The same code runs identically in the browser (guest mode, operating on in-memory data) and on the server (API routes, operating on fetched data).

## Dependencies

- **Sprint 3 complete:** Working planner UI with drag-and-drop courses into semesters, semester CRUD, plan persistence.
- **Database tables from Sprint 1:** `courses`, `course_prerequisites`, `requirement_sets`, `requirement_items`.
- **Shared types from Sprint 2/3:** Plan, Semester, and Course types used by the planner page.

---

## Technical Approach

### Phase 1: Planner Package -- Core Computation Engine

Replace the current stub (`helloPlanner`) with four pure functions. Each takes plain data in and returns plain results. No side effects, no DB calls, no React imports.

#### 1.1 Input Types

Define the data shapes the functions accept. These are lightweight interfaces derived from what the DB provides, not tied to Supabase types directly.

```typescript
// packages/planner/src/types.ts

/** A course placed in a plan semester. */
export interface PlanCourse {
  courseId: string;
  subjectCode: string;
  number: string;
  title: string;
  credits: number;
}

/** A semester in a degree plan. */
export interface PlanSemester {
  id: string;
  term: string; // "Fall", "Spring", "Summer"
  year: number;
  courses: PlanCourse[];
}

/** A full degree plan. */
export interface DegreePlan {
  id: string;
  programId: string;
  semesters: PlanSemester[];
}

/** A prerequisite rule for a course. */
export interface PrereqRule {
  courseId: string;
  prerequisiteCourseId: string | null;
  groupId: string;
  groupOperator: "AND" | "OR";
  condition: string;
  minGrade?: string;
  isCorequisite: boolean;
  descriptionOverride?: string;
}

/** A node in the requirement tree. */
export interface RequirementNode {
  id: string;
  parentId: string | null;
  label: string;
  type: "group" | "course" | "elective_slot" | "freetext";
  courseId: string | null;
  creditsRequired: number | null;
  coursesRequired: number | null;
  children: RequirementNode[];
}

/** Result of a prerequisite check. */
export interface PrereqResult {
  met: boolean;
  missing: string[]; // course codes like "CS 2420"
}

/** Per-group progress within a requirement tree. */
export interface GroupProgress {
  nodeId: string;
  label: string;
  required: number; // credits or course count depending on node
  completed: number;
  percentage: number; // 0-100, rounded to integer
  children: GroupProgress[];
}

/** Overall progress result. */
export interface ProgressResult {
  overall: number; // 0-100
  groups: GroupProgress[];
}

/** A prerequisite warning for a semester. */
export interface PrereqWarning {
  courseId: string;
  courseCode: string;
  missing: string[];
}

/** Credit summary for a plan. */
export interface CreditSummary {
  planned: number; // credits in future semesters
  completed: number; // credits in past semesters (based on current term)
  remaining: number; // total required minus completed minus planned
  totalRequired: number;
}
```

**File:** `packages/planner/src/types.ts` (new)

#### 1.2 `prerequisiteCheck(course, completedCourses, prereqRules)`

Checks whether a single course's prerequisites are satisfied by a set of completed courses.

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
2. Group rules by `groupId`.
3. For each group, evaluate rules based on `groupOperator`:
   - `AND`: all prerequisite courses in the group must be in `completedCourseIds`.
   - `OR`: at least one prerequisite course in the group must be in `completedCourseIds`.
4. All groups must pass for `met: true`.
5. `missing` collects the course IDs of unmet prerequisites.
6. Rules with `prerequisiteCourseId === null` and a `descriptionOverride` are skipped (freetext prereqs are not machine-checkable).
7. Corequisites (`isCorequisite: true`) are checked against completed OR in-progress (same semester). For this function, corequisites are treated as met if in `completedCourseIds` -- the caller is responsible for including same-semester courses when appropriate.

**Tests:** (`packages/planner/src/prerequisite-check.test.ts`)

- Course with no prereqs returns `{ met: true, missing: [] }`.
- AND group: all met returns met; one missing returns not met with the missing ID.
- OR group: one met returns met; none met returns not met with all IDs.
- Mixed groups: one AND + one OR group, partial completion.
- Freetext-only prereq (null prerequisiteCourseId) returns met.
- Corequisite included in completed set returns met.

#### 1.3 `computeProgress(requirementTree, completedCourseIds)`

Walks a requirement tree and computes per-group completion percentages.

```typescript
// packages/planner/src/compute-progress.ts

export function computeProgress(
  root: RequirementNode,
  completedCourseIds: Set<string>,
): ProgressResult;
```

**Logic:**

1. Recursive depth-first traversal of `root.children`.
2. Leaf nodes (`type: "course"`): completed if `courseId` is in `completedCourseIds`. Contributes 1 course or its credit value.
3. Leaf nodes (`type: "elective_slot"`): completed if any course in `completedCourseIds` is not already claimed by a `course` node in the same tree. Use a greedy claim set passed through recursion to avoid double-counting.
4. Group nodes (`type: "group"`): aggregate children. If `coursesRequired` is set, progress = min(completedChildren, coursesRequired) / coursesRequired. If `creditsRequired` is set, progress = min(completedCredits, creditsRequired) / creditsRequired.
5. `freetext` nodes are ignored (0/0, excluded from percentages).
6. Overall percentage = weighted average of top-level groups by their required credits/courses.

**Tests:** (`packages/planner/src/compute-progress.test.ts`)

- Single course node, completed and not completed.
- Group with 3 required courses, 2 completed returns 66%.
- Nested groups: inner group completed, outer group partial.
- Elective slot claimed by a non-required course.
- Empty tree returns 0%.
- All completed returns 100%.

#### 1.4 `semesterValidate(semester, priorSemesters, prereqRules)`

Validates all courses in a semester against prerequisites from prior semesters.

```typescript
// packages/planner/src/semester-validate.ts

export function semesterValidate(
  semester: PlanSemester,
  priorSemesters: PlanSemester[],
  prereqRules: PrereqRule[],
): PrereqWarning[];
```

**Logic:**

1. Build `completedCourseIds` from all courses in `priorSemesters`.
2. For corequisites, also include courses from the current `semester`.
3. For each course in `semester`, call `prerequisiteCheck`. If not met, produce a `PrereqWarning`.
4. Return the array of warnings (empty array = no issues).

**Tests:** (`packages/planner/src/semester-validate.test.ts`)

- Semester with no prereq issues returns `[]`.
- Course missing a prereq returns a warning with the missing code.
- Corequisite in same semester does not produce a warning.
- Multiple courses with issues returns multiple warnings.

#### 1.5 `creditSummary(plan, totalRequired, currentTerm)`

Computes a credit breakdown for at-a-glance status.

```typescript
// packages/planner/src/credit-summary.ts

export function creditSummary(
  plan: DegreePlan,
  totalRequired: number,
  currentTerm: { term: string; year: number },
): CreditSummary;
```

**Logic:**

1. Split semesters into past (before `currentTerm`) and future (currentTerm and after).
2. `completed` = sum of credits in past semesters.
3. `planned` = sum of credits in future semesters.
4. `remaining` = max(0, totalRequired - completed - planned).
5. Simple semester ordering: year first, then Fall < Spring < Summer within a year.

**Tests:** (`packages/planner/src/credit-summary.test.ts`)

- Plan with 30 completed, 30 planned, 120 required returns `{ completed: 30, planned: 30, remaining: 60, totalRequired: 120 }`.
- All credits completed returns remaining = 0.
- Over-planned (completed + planned > required) returns remaining = 0, not negative.
- Empty plan returns `{ completed: 0, planned: 0, remaining: 120, totalRequired: 120 }`.

#### 1.6 Package Barrel Export

```typescript
// packages/planner/src/index.ts
export { prerequisiteCheck } from "./prerequisite-check.js";
export { computeProgress } from "./compute-progress.js";
export { semesterValidate } from "./semester-validate.js";
export { creditSummary } from "./credit-summary.js";
export type * from "./types.js";
```

Remove the existing `helloPlanner` stub and its test.

#### 1.7 Package Updates

Update `packages/planner/package.json`:

- Upgrade `vitest` to `^3.2.0` (align with Sprint 1 upgrade).
- No new runtime dependencies. The planner is pure logic with zero deps beyond `@major-map/shared` (for `MajorId` if needed, though Sprint 4 types are self-contained).

**Files changed in Phase 1:**

- Delete: `packages/planner/src/index.test.ts` (stub test)
- Edit: `packages/planner/src/index.ts` (replace stub with barrel exports)
- Edit: `packages/planner/package.json` (vitest upgrade)
- New: `packages/planner/src/types.ts`
- New: `packages/planner/src/prerequisite-check.ts`, `packages/planner/src/prerequisite-check.test.ts`
- New: `packages/planner/src/compute-progress.ts`, `packages/planner/src/compute-progress.test.ts`
- New: `packages/planner/src/semester-validate.ts`, `packages/planner/src/semester-validate.test.ts`
- New: `packages/planner/src/credit-summary.ts`, `packages/planner/src/credit-summary.test.ts`

---

### Phase 2: Prereq Warning Badges on Planner Page

#### 2.1 Data Loading

The planner page (assumed to exist from Sprint 3 at `/planner/[id]`) already loads a plan with semesters and courses. Add a query to fetch prerequisite rules for all courses in the plan.

```typescript
// apps/web/src/lib/queries/prereq-rules.ts
// Fetch from course_prerequisites table for a set of course IDs.
// Returns PrereqRule[] shaped for the planner package.
```

This is a single Supabase query: `select * from course_prerequisites where course_id in (...)`. Run once on plan load and when courses change.

#### 2.2 Validation Hook

```typescript
// apps/web/src/hooks/use-semester-warnings.ts
import { semesterValidate } from "@major-map/planner";

// Calls semesterValidate for each semester in the plan.
// Returns a Map<semesterId, Map<courseId, PrereqWarning>>.
// Recomputes when plan.semesters or prereqRules change (useMemo).
```

No debounce needed -- `semesterValidate` operates on small arrays (a semester has ~5 courses, a plan has ~8 semesters). Computation is sub-millisecond.

#### 2.3 Warning Badge Component

```tsx
// apps/web/src/components/planner/prereq-badge.tsx
// - Yellow/amber MUI Chip or custom badge.
// - Tooltip on hover shows missing prereqs: "Missing: CS 2420, MATH 2210".
// - Placed on the course card in the semester column.
// - Only renders when warnings exist for that course.
```

**Design decisions:**

- Soft warning only: yellow badge, no blocking. The user can leave the course in place.
- No modal or confirmation dialog. YAGNI -- a badge + tooltip is sufficient.
- Badge disappears when the user adds the missing prereq to an earlier semester.

**Files changed in Phase 2:**

- New: `apps/web/src/lib/queries/prereq-rules.ts`
- New: `apps/web/src/hooks/use-semester-warnings.ts`
- New: `apps/web/src/components/planner/prereq-badge.tsx`
- Edit: `apps/web/src/components/planner/course-card.tsx` (add PrereqBadge)
- Edit: `apps/web/src/app/planner/[id]/page.tsx` (fetch prereq rules, pass to hook)

---

### Phase 3: Credit Summary Sidebar

#### 3.1 Credit Summary Hook

```typescript
// apps/web/src/hooks/use-credit-summary.ts
import { creditSummary } from "@major-map/planner";

// Wraps creditSummary with current term detection.
// Current term derived from today's date:
//   Jan-May = Spring, Jun-Jul = Summer, Aug-Dec = Fall.
// Returns CreditSummary. Recomputes on plan change (useMemo).
```

`totalRequired` comes from the `programs.total_credits` column for the plan's program. Fetched alongside the plan data.

#### 3.2 Sidebar Component

```tsx
// apps/web/src/components/planner/credit-sidebar.tsx
// - Compact sidebar or card displayed alongside the semester grid.
// - Three rows: Completed (green), Planned (blue), Remaining (gray).
// - Each row shows credit count and a simple MUI LinearProgress bar.
// - Total at the bottom: "X / Y credits".
// - No charts library needed -- MUI LinearProgress is sufficient.
```

**Design decisions:**

- No pie charts or complex visualizations. Linear progress bars are clearer for this data. YAGNI.
- Sidebar is always visible on the planner page (not a toggle or drawer).
- On mobile, sidebar collapses to a sticky summary bar at the top.

**Files changed in Phase 3:**

- New: `apps/web/src/hooks/use-credit-summary.ts`
- New: `apps/web/src/components/planner/credit-sidebar.tsx`
- Edit: `apps/web/src/app/planner/[id]/page.tsx` (add sidebar to layout)

---

### Phase 4: Progress Dashboard Page

#### 4.1 Route and Data Loading

```typescript
// apps/web/src/app/progress/[id]/page.tsx
// - [id] is the plan ID.
// - Fetches: plan (with semesters + courses), requirement_set (active),
//   requirement_items (full tree for the program).
// - Builds RequirementNode tree from flat requirement_items rows
//   (parent_id linking, sorted by sort_order).
// - Calls computeProgress from @major-map/planner.
```

Tree building is a straightforward flat-to-tree transform:

1. Index items by `id`.
2. For each item, push into parent's `children` array.
3. Root nodes have `parentId === null`.
4. Sort children by `sort_order`.

This logic lives in a shared utility since it may be reused:

```typescript
// apps/web/src/lib/build-requirement-tree.ts
export function buildRequirementTree(flatItems: RequirementItemRow[]): RequirementNode[];
```

#### 4.2 Progress Display Components

```tsx
// apps/web/src/components/progress/progress-group.tsx
// - Recursive component rendering a GroupProgress node.
// - Shows label, progress bar (MUI LinearProgress), percentage text.
// - Children rendered indented beneath.
// - Color coding: green (>= 100%), blue (in progress), gray (0%).

// apps/web/src/components/progress/progress-overview.tsx
// - Top section of the dashboard.
// - Large circular or linear progress indicator for overall %.
// - Text: "X% complete -- Y credits remaining".

// apps/web/src/components/progress/remaining-courses.tsx
// - List of courses not yet in the plan that are required.
// - Derived by diffing requirement tree course nodes against plan courses.
// - Simple MUI List with course code, title, credits.
// - "Add to plan" button deferred (would require planner page integration). YAGNI for Sprint 4.
```

**Design decisions:**

- Use MUI LinearProgress bars for group progress, not a charting library. Keeps the dependency footprint small.
- The overall progress indicator uses a single larger LinearProgress or a simple CSS circular indicator. No `@mui/x-charts` or recharts.
- "Remaining courses" is a flat list, not grouped. Grouping by requirement category can be added later if users need it.
- The page is read-only. No editing of the plan from the progress page.

**Files changed in Phase 4:**

- New: `apps/web/src/app/progress/[id]/page.tsx`
- New: `apps/web/src/lib/build-requirement-tree.ts`
- New: `apps/web/src/components/progress/progress-group.tsx`
- New: `apps/web/src/components/progress/progress-overview.tsx`
- New: `apps/web/src/components/progress/remaining-courses.tsx`

---

## What This Sprint Does NOT Include

- **Blocking prerequisite enforcement** -- warnings are soft (yellow badges). No drag-and-drop rejection.
- **Grade tracking** -- `minGrade` is stored in prereq rules but not checked against actual grades. There is no grade input in Sprint 4.
- **Advisor approval workflow** -- no approval states, no role-based access.
- **Charts library** -- MUI LinearProgress is used, not recharts/nivo/chart.js.
- **"Add to plan" from progress page** -- read-only dashboard. Editing happens on the planner page.
- **Elective recommendation engine** -- elective slots show as unfilled, but the system does not suggest courses.
- **Multi-program progress** -- one program per plan. Double majors are out of scope.

---

## File Summary

### New Files

| File                                                     | Purpose                                                 |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `packages/planner/src/types.ts`                          | Input/output type definitions for all planner functions |
| `packages/planner/src/prerequisite-check.ts`             | `prerequisiteCheck` pure function                       |
| `packages/planner/src/prerequisite-check.test.ts`        | Tests for prerequisite checking                         |
| `packages/planner/src/compute-progress.ts`               | `computeProgress` pure function                         |
| `packages/planner/src/compute-progress.test.ts`          | Tests for progress computation                          |
| `packages/planner/src/semester-validate.ts`              | `semesterValidate` pure function                        |
| `packages/planner/src/semester-validate.test.ts`         | Tests for semester validation                           |
| `packages/planner/src/credit-summary.ts`                 | `creditSummary` pure function                           |
| `packages/planner/src/credit-summary.test.ts`            | Tests for credit summary                                |
| `apps/web/src/lib/queries/prereq-rules.ts`               | Supabase query for prerequisite rules                   |
| `apps/web/src/lib/build-requirement-tree.ts`             | Flat requirement_items to tree transform                |
| `apps/web/src/hooks/use-semester-warnings.ts`            | Hook wrapping `semesterValidate`                        |
| `apps/web/src/hooks/use-credit-summary.ts`               | Hook wrapping `creditSummary`                           |
| `apps/web/src/components/planner/prereq-badge.tsx`       | Yellow warning badge for prereq issues                  |
| `apps/web/src/components/planner/credit-sidebar.tsx`     | Credit summary sidebar on planner page                  |
| `apps/web/src/components/progress/progress-group.tsx`    | Recursive progress bar for requirement groups           |
| `apps/web/src/components/progress/progress-overview.tsx` | Overall progress indicator                              |
| `apps/web/src/components/progress/remaining-courses.tsx` | List of remaining required courses                      |
| `apps/web/src/app/progress/[id]/page.tsx`                | Progress dashboard page                                 |

### Edited Files

| File                                              | Change                                          |
| ------------------------------------------------- | ----------------------------------------------- |
| `packages/planner/src/index.ts`                   | Replace `helloPlanner` stub with barrel exports |
| `packages/planner/package.json`                   | Upgrade vitest to `^3.2.0`                      |
| `apps/web/src/components/planner/course-card.tsx` | Add PrereqBadge rendering                       |
| `apps/web/src/app/planner/[id]/page.tsx`          | Fetch prereq rules, add credit sidebar          |

### Deleted Files

| File                                 | Reason                                         |
| ------------------------------------ | ---------------------------------------------- |
| `packages/planner/src/index.test.ts` | Stub test for `helloPlanner`, no longer needed |

---

## Acceptance Criteria

### Functional

- [ ] `pnpm -r build` succeeds (planner package compiles)
- [ ] `pnpm -r test` passes (all planner pure function tests green)
- [ ] `prerequisiteCheck` correctly evaluates AND groups, OR groups, corequisites, and freetext rules
- [ ] `computeProgress` returns correct per-group and overall percentages for a sample requirement tree
- [ ] `semesterValidate` returns warnings only for courses with unmet prereqs
- [ ] `creditSummary` returns correct completed/planned/remaining split
- [ ] Prereq warning badges appear on planner course cards when prerequisites are missing
- [ ] Badges disappear when missing prereqs are added to earlier semesters
- [ ] Credit summary sidebar shows correct numbers on the planner page
- [ ] Progress dashboard at `/progress/[id]` renders requirement group progress bars
- [ ] Progress dashboard shows remaining courses list

### Non-Functional

- [ ] Planner package has zero runtime dependencies beyond `@major-map/shared`
- [ ] All planner functions are pure (no side effects, no DB calls, no DOM access)
- [ ] Planner functions execute in < 1ms for a typical plan (8 semesters, 40 courses, 50 requirement nodes)
- [ ] No new npm dependencies added to the web app beyond what Sprint 3 already includes (MUI)

### Quality Gates

- [ ] Each planner function has at least 5 unit tests covering happy path, edge cases, and empty inputs
- [ ] Prereq badge tested with a plan fixture containing mixed met/unmet prerequisites
- [ ] CI passes on clean checkout
- [ ] No TypeScript `any` in planner package
