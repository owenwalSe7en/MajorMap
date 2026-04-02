---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, quality, sprint-4]
---

# Remove unused useMemo import in guest-planner.tsx

## Problem Statement
`apps/web/src/app/plans/guest-planner.tsx:3` imports `useMemo` but never uses it.

## Proposed Solutions
1. Remove `useMemo` from the import statement
   - Effort: Small
   - Risk: None
