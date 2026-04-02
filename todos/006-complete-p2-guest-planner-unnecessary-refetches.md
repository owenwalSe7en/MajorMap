---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance, sprint-4]
---

# Guest planner refetches prereq rules on every plan mutation

## Problem Statement
`apps/web/src/app/plans/guest-planner.tsx` has a useEffect that fetches both course data and prereq rules whenever `plan` changes. Since `plan` is a new object reference on every mutation (add/remove course/semester), this causes unnecessary network requests even when the course list hasn't changed.

## Findings
- Lines 35-58: useEffect depends on `plan` which changes on every mutation
- fetchPrereqRules is called even when only a semester was added (no new courses)
- fetchCoursesByIds is called even when the course list is identical

## Proposed Solutions
1. Derive the course ID list and use it as the effect dependency instead of `plan`:
   ```ts
   const allIds = plan?.semesters.flatMap((s) => s.courseIds).sort().join(",") ?? "";
   useEffect(() => { ... }, [allIds]);
   ```
   - Effort: Small
   - Risk: Low

## Acceptance Criteria
- [ ] Prereq rules only refetch when course IDs actually change
- [ ] No behavior change for users
