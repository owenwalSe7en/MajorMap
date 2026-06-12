---
status: pending
priority: p1
issue_id: 010
tags: [code-review, security, web]
dependencies: []
---

# importTranscriptCourses violates the university-scoping invariant

## Problem Statement

[apps/web/src/app/plans/actions.ts](../apps/web/src/app/plans/actions.ts) `importTranscriptCourses` validates client-supplied course ids with an UNSCOPED `courses` lookup (existence only), selects the plan without `.eq("user_id")` (RLS-only) and without `university_id`, has no `isUuid(planId)` guard, and no `is_discontinued` check. Once BYU is seeded, a direct action call can import another school's (or discontinued) courses into a Utah plan as `status: "completed"`, corrupting credit summaries and suggestions — the exact corruption `parseTranscriptAction` was scoped in this same PR to prevent.

## Findings

- kieran-typescript-reviewer P1; security-sentinel P3-1/P3-2 (same root cause); code-simplicity-reviewer side note.
- `addCourse` has the same missing university-match (its course lookup checks discontinued but not `university_id`).

## Proposed Solutions

1. **(Recommended)** Mirror `parseTranscriptAction`: `isUuid(planId)` guard; plan select adds `.eq("user_id", user.id)` + `university_id`; course validation adds `.eq("university_id", plan.university_id ?? UTAH_UNIVERSITY_ID)`. Add the same university filter to `addCourse`'s course lookup.

## Acceptance Criteria

- [ ] Plan lookup: explicit user_id + university_id, UUID-validated planId
- [ ] Course validation scoped to the plan's university
- [ ] addCourse course lookup scoped to the plan's university (derive via semester → plan)
- [ ] Tests cover cross-school rejection

## Work Log

- 2026-06-11: Found during PR #8 review.
