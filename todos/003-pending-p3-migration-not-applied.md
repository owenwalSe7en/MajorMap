---
status: pending
priority: p3
issue_id: "003"
tags: [code-review, database]
dependencies: []
---

# Migration SQL not yet applied to remote Supabase

## Problem Statement
The migration at `supabase/migrations/20260401000001_catalog_schema.sql` was created but could not be applied programmatically. The Supabase CLI requires a database password (not service role key) for direct connections.

## Proposed Solutions
1. Apply via Supabase Dashboard SQL Editor — paste the migration SQL
   - Effort: Small (manual)
2. Set up Supabase CLI with proper database URL from dashboard settings
   - Effort: Small

## Acceptance Criteria
- [ ] All 7 tables exist in the remote Supabase project
- [ ] RLS policies are active
- [ ] Indexes are created
- [ ] `pnpm catalog:seed` can successfully upsert data
