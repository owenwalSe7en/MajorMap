---
title: "Sprint 6: Course Suggestions"
type: feat
date: 2026-04-02
dependencies: "Sprint 4 (progress engine, prereq validation)"
---

# Sprint 6: Course Suggestions

## Overview

The app recommends which courses to take next based on remaining degree requirements and prerequisite chains. A "Suggested Courses" panel in the planner sidebar shows ranked recommendations. Students can add suggestions to a semester with one click.

## Design Decisions

### D1: Suggestion Engine is a Pure Function

The engine lives in `packages/planner/src/suggestions/engine.ts` — pure computation, no DB, no side effects. Takes plan data + requirement items + prereq graph, returns ranked suggestions. Testable with inline data.

### D2: Requirements Fetched via requirement_items Tree

Programs → requirement_sets (active) → requirement_items (tree via parent_id). Leaf items with `course_id IS NOT NULL` identify exact required courses. The plan page fetches this data server-side and passes it to the engine.

### D3: Availability Filtering Deferred

The `courses.typically_offered` field is currently empty (`[]`) in the catalog. Availability-based ranking is deferred until the catalog pipeline populates this field. The engine accepts the field but doesn't rank by it yet.

### D4: Panel Placement — Below CreditSidebar in Right Rail

The suggestions panel sits below the credit summary in the existing `<aside>` column. This keeps the "intelligence" features together and close to the semester cards where users add courses.

### D5: Program Required — No Suggestions Without a Program

If `plan.program_id` is null, the suggestions panel shows a message prompting the user to select a program. No suggestions can be computed without knowing the degree requirements.

---

## Technical Approach

### Phase 1: Suggestion Engine (Pure Function)

```typescript
// packages/planner/src/suggestions/engine.ts

export interface RequirementItem {
  id: string;
  courseId: string | null;    // null for group nodes / elective slots
  label: string;
  parentId: string | null;
  creditsRequired: number | null;
  coursesRequired: number | null;
}

export interface SuggestedCourse {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  reason: string;           // "Required for CS BS", "Unlocks 3 courses"
  priority: number;         // higher = suggest first
  category: string;         // parent requirement label ("Core", "Electives", etc.)
  unlockCount: number;      // how many downstream courses this enables
}

export function suggestCourses(
  planCourses: Array<{ courseId: string; status?: string }>,
  requirementItems: RequirementItem[],
  prereqRules: PrereqRule[],
  courseCatalog: Array<{ id: string; code: string; title: string; credits: number }>,
  courseCodeMap: Map<string, string>,
): SuggestedCourse[]
```

Ranking algorithm:
1. **Identify remaining required courses**: Diff requirement_items (leaf nodes with course_id) against plan courses (both completed and planned)
2. **Filter to prereqs-met**: For each candidate, run `prerequisiteCheck` against completed courses
3. **Compute unlock count**: Walk prereq graph in reverse — count how many remaining required courses list this candidate as a prerequisite
4. **Score**: `priority = (isRequired ? 100 : 0) + unlockCount * 10`
5. **Sort descending by priority**, return top 20

**File:** `packages/planner/src/suggestions/engine.ts` (new)
**Test:** `packages/planner/src/suggestions/engine.test.ts` (new)

### Phase 2: Fetch Requirements Data in Plan Page

Add server-side data fetching for requirement_items in `page.tsx`.

```typescript
// apps/web/src/app/plans/[id]/page.tsx additions:
// 1. Fetch active requirement_set for plan.program_id
// 2. Fetch all requirement_items for that set
// 3. Fetch candidate courses (required but not in plan)
// 4. Pass to suggestion engine + new SuggestionsPanel component
```

New queries (add to existing Promise.all):
- `requirement_sets` WHERE `program_id = plan.program_id AND is_active = true`
- `requirement_items` WHERE `requirement_set_id = <active_set.id>`
- `courses` WHERE `id IN (<required_course_ids_not_in_plan>)` — for title/code/credits of candidates

**File:** `apps/web/src/app/plans/[id]/page.tsx` (edit)

### Phase 3: Suggestions Panel Component

```typescript
// apps/web/src/app/plans/[id]/suggestions-panel.tsx
// Props: { suggestions: SuggestedCourse[]; semesters: SemesterData[]; planId: string }
//
// - Scrollable list of suggestion cards
// - Each card: code, title, credits, reason badge, category tag
// - "Add" button with semester dropdown (defaults to last semester)
// - On add: calls addCourse server action, page refreshes
// - Empty state when no suggestions or no program selected
// - Category filter pills at top (derived from unique categories)
```

**File:** `apps/web/src/app/plans/[id]/suggestions-panel.tsx` (new)
**Test:** `apps/web/src/app/plans/[id]/suggestions-panel.test.tsx` (new)

### Phase 4: Wire Up — Plan Page Layout

Add `SuggestionsPanel` below `CreditSidebar` in the aside column.

```typescript
// apps/web/src/app/plans/[id]/page.tsx (edit)
<aside className="order-first lg:order-none lg:w-72 shrink-0 space-y-4">
  <CreditSidebar credits={credits} totalPlanned={totalPlanned} />
  {suggestions.length > 0 && (
    <SuggestionsPanel
      suggestions={suggestions}
      semesters={semesterData}
      planId={id}
    />
  )}
</aside>
```

Widen the aside from `lg:w-64` to `lg:w-72` to accommodate suggestion cards.

**File:** `apps/web/src/app/plans/[id]/page.tsx` (edit)

---

## Acceptance Criteria

### Functional

- [ ] Suggestions panel shows ranked courses based on remaining requirements
- [ ] Required courses with satisfied prereqs appear before electives
- [ ] Courses that unlock the most downstream courses rank higher
- [ ] "Add to Semester" inserts course into plan and refreshes suggestions
- [ ] Category filter narrows suggestions to selected requirement group
- [ ] Empty state when all requirements are planned
- [ ] Empty state when no program is selected
- [ ] Panel does not suggest courses already in the plan (completed or planned)

### Non-Functional

- [ ] Suggestion engine is a pure function with no DB dependencies
- [ ] All new code has colocated test files
- [ ] TDD: tests written before implementation

### Quality Gates

- [ ] Engine unit tests: fresh plan, partially complete, fully planned, no program, prereq chain depth
- [ ] Component tests: panel renders suggestions, category filter works, add button triggers action

---

## Files to Modify

### New Files

| File | Package | Purpose |
|------|---------|---------|
| `packages/planner/src/suggestions/engine.ts` | planner | Pure suggestion ranking engine |
| `packages/planner/src/suggestions/engine.test.ts` | planner | Engine unit tests |
| `apps/web/src/app/plans/[id]/suggestions-panel.tsx` | web | Suggestions UI panel |
| `apps/web/src/app/plans/[id]/suggestions-panel.test.tsx` | web | Panel component tests |

### Edited Files

| File | Change |
|------|--------|
| `packages/planner/src/index.ts` | Export suggestCourses and types |
| `packages/planner/src/types.ts` | Add RequirementItem and SuggestedCourse types |
| `apps/web/src/app/plans/[id]/page.tsx` | Fetch requirements, compute suggestions, add panel to layout |

---

## Implementation Order (TDD)

1. **Engine tests** → engine implementation (packages/planner)
2. **Plan page data fetching** — add requirement queries
3. **Panel component tests** → panel implementation
4. **Plan page layout** — wire panel into aside column
5. **Run all tests + lint**

---

## Deferred

- Availability filtering (when `typically_offered` is populated)
- Elective slot suggestions (requirement_items with null course_id)
- Program picker (Sprint 7+)
- Suggestion dismissal / "not interested" feature
