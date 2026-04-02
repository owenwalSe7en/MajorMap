---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, performance, sprint-4]
---

# Parallelize server component Supabase queries

## Problem Statement
`apps/web/src/app/plans/[id]/page.tsx` makes 5-6 sequential Supabase queries that could be partially parallelized. The prereq rules query, prereq course codes query, and program query are all independent of each other and can run in parallel with `Promise.all`.

## Findings
- Lines 73-89: prereqRows query depends on allCourseIds (from courses query) — sequential OK
- Lines 91-94: prereqCourseIds filtering + prereqCourses query is independent of courseCodeMap building
- Lines 107-114: program query is fully independent of prereq queries
- Estimated savings: ~50-100ms on plan pages with prereqs + program

## Proposed Solutions
1. Use `Promise.all` to parallelize the prereqCourses query and program query after prereqRows is fetched
   - Effort: Small
   - Risk: Low

## Acceptance Criteria
- [ ] Independent queries run in parallel with Promise.all
- [ ] No change to behavior or data correctness
