---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, security, quality]
dependencies: []
---

# Missing environment variable validation at startup

## Problem Statement

The `supabase-client.ts` validates env vars, but `coursedog.ts` only checks at runtime when `fetchAll()` is called. If a developer forgets to set `COURSEDOG_API_URL`, they get a cryptic runtime error deep in the fetch loop instead of an immediate startup failure.

## Findings

- `packages/catalog/src/supabase-client.ts:5-9` — good: throws early if missing
- `packages/catalog/src/sources/coursedog.ts:14-19` — bad: validates in `getConfig()` which is called lazily

## Proposed Solutions

1. Move env validation to module-level or CLI entry point
   - Effort: Small
   - Risk: Low

## Acceptance Criteria

- [ ] Running `catalog:fetch` without COURSEDOG_API_URL set gives a clear error message immediately
- [ ] Running `catalog:seed` without SUPABASE vars gives a clear error message immediately
