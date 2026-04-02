---
title: "Sprint 7: Multi-Program Comparison"
type: feat
date: 2026-04-01
dependencies: "Sprint 3 (planner), Sprint 4 (progress engine)"
---

# Sprint 7: Multi-Program Comparison

## Overview

Students can compare two programs side-by-side, see overlapping courses, plan for a double major or minor, and run "what-if" analyses to see how their current courses would apply to a different program.

## Technical Approach

### 1. Overlap Analysis Engine

Compute shared courses between two programs by comparing their requirement_items.

```typescript
// packages/planner/src/comparison/overlap.ts
interface OverlapResult {
  programA: { id: string; name: string; totalCredits: number };
  programB: { id: string; name: string; totalCredits: number };
  sharedCourses: { courseId: string; code: string; title: string; credits: number }[];
  sharedCredits: number;
  combinedUniqueCredits: number; // Total if pursuing both, after deducting overlap
  onlyA: { courseId: string; code: string }[];
  onlyB: { courseId: string; code: string }[];
}
```

- Fetch active requirement_sets for both programs
- Flatten requirement_items of type "course" to get course ID sets
- Set intersection = shared, set differences = unique to each
- Sum credits for combined estimate

**File:** `packages/planner/src/comparison/overlap.ts` (new)

### 2. Compare Page

New route `/compare` with program selection and side-by-side view.

- Two program selectors (searchable dropdowns, reuse program browse from Sprint 2)
- Side-by-side requirement lists, shared courses highlighted with a distinct color
- Summary bar: "X shared credits, Y total unique credits needed for both"
- Link to planner: "Plan for both programs"

**Files:**

- `apps/web/app/compare/page.tsx` (new)
- `apps/web/app/compare/components/ComparisonView.tsx` (new)
- `apps/web/app/compare/components/ProgramSelector.tsx` (new)

### 3. Multi-Program Plan Support

Allow a plan to have a primary and optional secondary program. Validate planned courses against both programs' requirements.

- Add `secondary_program_id` column to `semester_plans` table (nullable FK to programs)
- Progress engine evaluates both programs, returns two progress summaries
- Planner UI shows dual progress bars when secondary program is set
- Program selector in plan settings to add/remove secondary program

**Files:**

- `supabase/migrations/YYYYMMDD_add_secondary_program.sql` (new)
- `packages/planner/src/progress/engine.ts` (edit -- accept optional secondary program)
- `apps/web/app/planner/components/PlanSettings.tsx` (edit -- secondary program selector)
- `apps/web/app/planner/components/ProgressHeader.tsx` (edit -- dual progress bars)

### 4. What-If Analysis

Select a different program and see how current completed + planned courses map to its requirements.

- Reuse the progress engine: run it with the student's current courses against the hypothetical program
- Display on `/compare` page as a tab: "What-If" alongside "Side-by-Side"
- Show: courses that apply, courses that don't count, remaining requirements
- No data mutation -- read-only analysis

**Files:**

- `apps/web/app/compare/components/WhatIfView.tsx` (new)
- `packages/planner/src/comparison/whatif.ts` (new -- thin wrapper around progress engine)

---

## Acceptance Criteria

- [ ] Selecting two programs shows side-by-side requirements with overlapping courses highlighted
- [ ] Overlap summary displays shared credit count and combined unique credits
- [ ] A plan can have a secondary program; progress tracks both
- [ ] What-if analysis correctly maps current courses to a hypothetical program
- [ ] What-if shows remaining requirements for the hypothetical program
- [ ] Overlap engine unit tests cover: identical programs (100% overlap), disjoint programs (0% overlap), partial overlap
- [ ] Secondary program is optional -- removing it reverts to single-program tracking

## Files to Modify

- **New:** `packages/planner/src/comparison/overlap.ts`
- **New:** `packages/planner/src/comparison/overlap.test.ts`
- **New:** `packages/planner/src/comparison/whatif.ts`
- **New:** `apps/web/app/compare/page.tsx`
- **New:** `apps/web/app/compare/components/ComparisonView.tsx`
- **New:** `apps/web/app/compare/components/ProgramSelector.tsx`
- **New:** `apps/web/app/compare/components/WhatIfView.tsx`
- **New:** `supabase/migrations/YYYYMMDD_add_secondary_program.sql`
- **Edit:** `packages/planner/src/progress/engine.ts`
- **Edit:** `apps/web/app/planner/components/PlanSettings.tsx`
- **Edit:** `apps/web/app/planner/components/ProgressHeader.tsx`
