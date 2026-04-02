---
status: complete
priority: p3
issue_id: "003"
tags: [code-review, simplicity]
---

# Remove redundant code: totalCredits, title guard, unused export

## Problem Statement
Minor code quality items: `ParseResult.totalCredits` computed in parser but shadowed in action; `title || undefined` is redundant; `ALL_GRADES` exported but unused externally.

## Findings
- `parser.ts:118`: `totalCredits` in ParseResult never consumed (action computes its own)
- `parser.ts:83`: `title || undefined` — title is already undefined when no fields
- `index.ts:3`: `ALL_GRADES` re-exported but unused by consumers

## Proposed Solutions
1. Remove `totalCredits` from ParseResult, remove `|| undefined`, un-export `ALL_GRADES` from index
