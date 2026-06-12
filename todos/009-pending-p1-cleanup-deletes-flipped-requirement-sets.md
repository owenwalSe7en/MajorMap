---
status: pending
priority: p1
issue_id: 009
tags: [code-review, data-integrity, catalog]
dependencies: []
---

# Seed failure cleanup deletes already-activated requirement sets

## Problem Statement

`cleanupNewSets` in [packages/catalog/src/seed.ts](../packages/catalog/src/seed.ts) deletes ALL `newSetIds` when any flip chunk fails. Flips run in chunks of 100, each chunk a separately committed transaction. If chunk 1 commits and chunk 2 throws, cleanup deletes chunk 1's sets — which are now the ACTIVE sets, whose predecessors were already deactivated inside chunk 1's committed transaction. Result: those programs end with ZERO active requirement sets and their item trees cascade-deleted. Every `.eq("is_active", true)` consumer silently shows no requirements.

## Findings

- data-integrity-guardian: the comment "Leave the previously active sets untouched" is false for committed chunks. Per-chunk atomicity is otherwise fine.
- The realistic trigger is a manual seed racing the cron (retention delete of run B removes run A's not-yet-flipped sets → `not found` raise → abort path).
- With the fix, both orderings of the cleanup-vs-flip race converge safely under READ COMMITTED.

## Proposed Solutions

1. **(Recommended, one line)** Filter the cleanup delete: `.delete().eq("is_active", false).in("id", ids)` — a flipped set is complete, valid, live data; only inactive debris is removed. Also log cleanup errors instead of swallowing.
2. Single flip call (no chunking) — caps at PostgREST payload limits, loses batching benefits.

## Acceptance Criteria

- [ ] Cleanup delete carries `.eq("is_active", false)`
- [ ] Cleanup errors logged
- [ ] Comment updated to state the invariant

## Work Log

- 2026-06-11: Found by data-integrity-guardian during PR #8 review.
