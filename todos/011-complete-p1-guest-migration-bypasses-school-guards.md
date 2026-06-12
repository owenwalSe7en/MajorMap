---
status: complete
priority: p1
issue_id: 011
tags: [code-review, security, web]
dependencies: []
---

# migrateGuestPlan bypasses cross-school/discontinued guards; schoolSlug unread

## Problem Statement

[apps/web/src/app/plans/actions.ts](../apps/web/src/app/plans/actions.ts) `migrateGuestPlan` validates the localStorage-supplied `programId` for existence only â€” no `university_id` match, no `is_discontinued` check â€” while hardcoding the new plan's university to Utah and ignoring the `GuestPlan.schoolSlug` field added in this same PR. A crafted payload attaches a BYU or discontinued program to a Utah plan, bypassing `setPlanProgram`'s guards. Related inconsistency: `setPlanProgram` skips its cross-school guard when `plan.university_id` is null instead of defaulting to Utah like `parseTranscriptAction`.

## Findings

- kieran-typescript-reviewer P1; security-sentinel P2-1 + P3-3; simplicity review flagged `schoolSlug` as write-only YAGNI â€” consuming it here resolves both findings.

## Proposed Solutions

1. **(Recommended)** Resolve the plan's university from `schoolSlug` validated against the shared `SCHOOLS` registry (fallback Utah); validate `programId` with `.eq("university_id", resolved)` + reject discontinued; course-id validation also scoped. In `setPlanProgram`, replace `if (plan.university_id && ...)` with `const uid = plan.university_id ?? UTAH_UNIVERSITY_ID` so the guard always runs.

## Acceptance Criteria

- [ ] schoolSlug consumed (validated, defaulted)
- [ ] Guest programId checked for school match + discontinued
- [ ] Guest course validation university-scoped
- [ ] setPlanProgram guard runs for null university_id
- [ ] Tests cover crafted cross-school payloads

## Work Log

- 2026-06-11: Found during PR #8 review.
