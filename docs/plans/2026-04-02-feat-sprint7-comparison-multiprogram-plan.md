---
title: "Sprint 7: Multi-Program Comparison"
type: feat
date: 2026-04-02
dependencies: "Sprint 3 (planner), Sprint 6 (suggestions engine)"
---

# Sprint 7: Multi-Program Comparison

## Overview

Students can compare two programs side-by-side to see overlapping courses, plan for a double major or minor, and run what-if analyses to see how current courses apply to a different program.

## Design Decisions

### D1: Overlap Engine is a Pure Function
Lives in `packages/planner/src/comparison/overlap.ts`. Takes two sets of requirement items, returns shared/unique courses. No DB.

### D2: Compare Page is a New Route
`/compare` route with program selectors. Server component fetches requirement data for both selected programs.

### D3: Secondary Program on Plan (Migration)
Add `secondary_program_id` column to `semester_plans`. Progress engine evaluates both programs when set.

### D4: What-If is Read-Only
Reuses the overlap engine + existing plan data. No mutations. Just shows how current courses map to a hypothetical program.

### D5: File Paths Match Actual Codebase
All web files under `apps/web/src/app/`, not `apps/web/app/`.

---

## Technical Approach

### Phase 1: Overlap Engine (Pure Function)

```typescript
// packages/planner/src/comparison/overlap.ts
export interface ProgramRequirements {
  programId: string;
  programName: string;
  totalCredits: number;
  courseIds: Set<string>;
}

export interface OverlapResult {
  shared: string[];           // course IDs in both programs
  onlyA: string[];            // course IDs only in program A
  onlyB: string[];            // course IDs only in program B
  sharedCredits: number;
  combinedUniqueCredits: number;
}

export function computeOverlap(
  programA: ProgramRequirements,
  programB: ProgramRequirements,
  courseCreditMap: Map<string, number>,
): OverlapResult
```

**File:** `packages/planner/src/comparison/overlap.ts` (new)
**Test:** `packages/planner/src/comparison/overlap.test.ts` (new)

### Phase 2: Database Migration

```sql
-- supabase/migrations/20260402000003_add_secondary_program.sql
ALTER TABLE public.semester_plans
  ADD COLUMN secondary_program_id uuid
    REFERENCES public.programs(id) ON DELETE SET NULL;
```

### Phase 3: Compare Page

New route at `/compare` with two program selectors and results.

```typescript
// apps/web/src/app/compare/page.tsx
// Server component:
// - URL params: ?a=<programId>&b=<programId>
// - Fetches requirement_items for both programs
// - Computes overlap
// - Renders ComparisonView
```

**Files:**
- `apps/web/src/app/compare/page.tsx` (new)
- `apps/web/src/app/compare/comparison-view.tsx` (new)
- `apps/web/src/app/compare/program-selector.tsx` (new)

### Phase 4: What-If Analysis

Tab on the compare page showing how current plan courses map to a hypothetical program.

```typescript
// apps/web/src/app/compare/what-if-view.tsx
// Takes: user's plan courses, target program's requirements
// Shows: matching courses, non-matching courses, remaining requirements
```

### Phase 5: Multi-Program Plan Support

Update plan page to show dual progress when secondary_program_id is set.

**Files:**
- `apps/web/src/app/plans/[id]/page.tsx` (edit — fetch secondary program, dual credit summary)
- `apps/web/src/app/plans/[id]/credit-sidebar.tsx` (edit — show secondary progress)

---

## Acceptance Criteria

- [ ] Selecting two programs shows side-by-side requirements with overlapping courses highlighted
- [ ] Overlap summary displays shared credit count and combined unique credits
- [ ] A plan can have a secondary program; progress tracks both
- [ ] What-if analysis correctly maps current courses to a hypothetical program
- [ ] Overlap engine unit tests: identical programs, disjoint, partial overlap
- [ ] Secondary program is optional — removing it reverts to single-program tracking

## Implementation Order (TDD)

1. Overlap engine tests → implementation
2. Migration
3. Compare page + program selector
4. What-if view
5. Dual progress in plan page
6. Tests + lint

## Deferred

- Program picker on the plan page (Sprint 8)
- Auto-suggest double major combinations
- Transfer credit mapping across programs
