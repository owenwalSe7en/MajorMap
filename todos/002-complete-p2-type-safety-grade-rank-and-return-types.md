---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, typescript, type-safety]
---

# Improve type safety: GRADE_RANK, server action return types, PlanCourse.grade

## Problem Statement
Several type safety gaps: GRADE_RANK uses `Record<string, number>` instead of `Record<Grade, number>`, server actions lack explicit return types causing unsafe `as` casts in the modal, and `PlanCourse.grade` is `string` instead of `Grade`.

## Findings
- `parser.ts:14`: `GRADE_RANK: Record<string, number>` — accepts arbitrary keys
- `transcript-import-modal.tsx:137-142`: Unsafe `as` cast because action return type isn't discriminated
- `types.ts:29`: `grade?: string` should reference `Grade` type
- `actions.ts:199,248`: No explicit return type annotations

## Proposed Solutions
1. Type GRADE_RANK as `Record<Grade, number>`, define discriminated union return types for actions, use `Grade` in PlanCourse
2. Remove the `as` cast in modal after return types are explicit
