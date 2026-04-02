---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, security, input-validation]
---

# Validate grade input in importTranscriptCourses server action

## Problem Statement
The `importTranscriptCourses` server action accepts a `courses` array with `{ courseId, grade }` but never validates that `grade` is a valid value from `ALL_GRADES`. Invalid grades hit the DB CHECK constraint, leaking schema details in the error message. Also missing: type checks on courseId/grade being strings, and an upper bound on array length.

## Findings
- `actions.ts:248-318`: No validation of `grade` field against allowed values
- `actions.ts:314`: `upsertError.message` returned directly to client, may contain constraint/table names
- No limit on `courses.length` — could be arbitrarily large

## Proposed Solutions
1. Add input validation at top of function: check types, validate grades against `ALL_GRADES`, cap array at 200 courses
2. Replace raw DB error messages with generic user-facing errors
