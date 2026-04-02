---
status: pending
priority: p3
issue_id: "003"
tags: [code-review, architecture]
---

## Problem Statement

`apps/web/src/app/plans/page.tsx:28-33` auto-creates a plan in a server component render if none exists. Concurrent requests could create duplicate plans. Low probability for MVP but worth noting.

## Proposed Solutions

1. **Accept for MVP** — The single-plan redirect picks most recent, so duplicates are harmless. Clean up in multi-plan Sprint.
2. **Use upsert or check-then-insert** — Add a unique constraint or use conditional insert.

## Acceptance Criteria

- [ ] Decision documented on whether to fix now or defer
