---
title: "Sprint 6: Course Suggestions"
type: feat
date: 2026-04-01
dependencies: "Sprint 4 (progress engine, prereq validation)"
---

# Sprint 6: Course Suggestions

## Overview

The app recommends which courses to take next based on remaining requirements, prerequisite chains, and availability. A "Suggested Courses" panel on the planner page shows ranked recommendations. Students can add suggestions to a semester with one click.

## Technical Approach

### 1. Suggestion Engine

Build the suggestion ranking logic in `@major-map/planner`.

```typescript
// packages/planner/src/suggestions/engine.ts
interface SuggestedCourse {
  courseId: string;
  reason: string; // "Required for CS BS", "Unlocks 3 courses", etc.
  priority: number; // Higher = suggest first
  category?: string; // Requirement category label
  availableSemesters: string[]; // ["Fall", "Spring"]
}

// Ranking factors (in priority order):
// 1. Required courses whose prereqs are ALL satisfied -> highest priority
// 2. Courses that unlock the most downstream courses (prereq chain depth)
// 3. Courses available in the next upcoming semester
// 4. Elective slots in unfilled requirement categories
```

- Input: student's plan (completed + planned courses), program requirements, prereq graph
- Output: sorted array of `SuggestedCourse`
- Query remaining requirements from progress engine (Sprint 4)
- Walk prereq graph to compute "unlock count" for each candidate

**File:** `packages/planner/src/suggestions/engine.ts` (new)

### 2. Suggested Courses Panel

Server component that fetches suggestions and renders a scrollable list on the planner page.

- Each suggestion card shows: course code, title, credits, reason tag, and availability
- "Add to Semester" button with semester dropdown (defaults to next unfilled semester)
- Empty state: "All requirements planned! Review your schedule." when no suggestions remain

**Files:**

- `apps/web/app/planner/components/SuggestionsPanel.tsx` (new)
- `apps/web/app/planner/components/SuggestionCard.tsx` (new)

### 3. One-Click Add to Semester

Clicking "Add to Semester" inserts the course into `plan_courses` for the selected semester and removes it from the suggestions list (optimistic UI update).

- Reuses existing plan mutation from Sprint 3
- After add, re-rank remaining suggestions (a newly planned course may unlock new candidates)

**File:** `apps/web/app/planner/components/SuggestionCard.tsx` (handled in component)

### 4. Category Filter

Simple filter bar above the suggestions list. Tabs or pill buttons for requirement categories (e.g., "Core", "Electives", "General Ed"). "All" selected by default.

- Categories derived from the program's requirement_items labels
- Client-side filter only (no additional API call)

**File:** `apps/web/app/planner/components/SuggestionsPanel.tsx` (integrated into panel)

---

## Acceptance Criteria

- [ ] Suggestions panel shows ranked courses based on remaining requirements
- [ ] Required courses with satisfied prereqs appear before electives
- [ ] Courses that unlock the most downstream courses rank higher
- [ ] "Add to Semester" inserts course into plan and refreshes suggestions
- [ ] Category filter correctly narrows suggestions to selected requirement group
- [ ] Empty state displays when all requirements are planned
- [ ] Suggestion engine unit tests cover: fresh plan (all required), partially complete plan, fully planned
- [ ] Panel does not suggest courses already in the plan (completed or planned)

## Files to Modify

- **New:** `packages/planner/src/suggestions/engine.ts`
- **New:** `packages/planner/src/suggestions/engine.test.ts`
- **New:** `apps/web/app/planner/components/SuggestionsPanel.tsx`
- **New:** `apps/web/app/planner/components/SuggestionCard.tsx`
- **Edit:** `apps/web/app/planner/page.tsx` (add SuggestionsPanel to layout)
