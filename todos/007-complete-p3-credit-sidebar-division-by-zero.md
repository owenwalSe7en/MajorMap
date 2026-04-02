---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, quality, sprint-4]
---

# Credit sidebar division by zero when totalRequired is 0

## Problem Statement
`apps/web/src/app/plans/[id]/credit-sidebar.tsx:9` computes `credits.planned / credits.totalRequired` which would be `Infinity` if `totalRequired` is 0.

## Findings
- Line 9: `const pct = Math.min(100, Math.round((credits.planned / credits.totalRequired) * 100));`
- If a program has total_credits = 0 (unlikely but possible), pct becomes NaN or Infinity
- Math.min(100, NaN) = NaN, Math.round(NaN) = NaN

## Proposed Solutions
1. Guard: `const pct = credits.totalRequired > 0 ? Math.min(100, Math.round(...)) : 0;`
   - Effort: Small
   - Risk: None

## Acceptance Criteria
- [ ] No NaN rendered when totalRequired is 0
