---
status: pending
priority: p3
issue_id: 013
tags: [code-review, quality, cleanup]
dependencies: []
---

# PR #8 review: P3 cleanup batch

## Problem Statement

Low-stakes cleanup and hardening from the PR #8 review, batched.

## Findings

1. Dead code: `isValidSchoolSlug` + private pattern in [packages/shared/src/schools.ts](../packages/shared/src/schools.ts) (no callers); `RequirementWork.stats` populated but never read in seed.ts; redundant `page.data.length === 0` clause in coursedog.ts pagination loop.
2. `UTAH_UNIVERSITY_ID` duplicates the literal in `SCHOOLS[0]` — derive one from the other.
3. `resolveSchool` re-tests a third copy of the slug regex before a 2-element list lookup — body can be `schoolBySlug(slug) ?? null`.
4. `schoolBySlugOrThrow` loads/parses schools.json twice on the error path.
5. `hero-section.tsx` hardcodes `/utah/programs` while siblings use `DEFAULT_SCHOOL_SLUG`.
6. `probe.ts` duplicates `headersFor`/`API_BASE` from `sources/coursedog.ts` — export once with optional UA.
7. Migrations: add `if exists/if not exists` guards for manual-apply resumability; collapse the FK drop+add into one `ALTER TABLE` statement; add `where university_id is null` to the backfill (avoids clobbering `updated_at` on every plan via trigger).
8. Production fetcher lacks `AbortSignal.timeout` (probe has one); `catalogId` interpolated unencoded into URLs; probe `SCHOOL_ID_RE` permits dots (reject `..`).
9. Sitemap includes discontinued programs; program detail page doesn't badge a discontinued program itself.
10. `courses/[code]` `code.split("-")` fragility + duplicated lookup between generateMetadata and page (wrap in React `cache()`).
11. Compare page selections not URL-addressable (`?a=&b=` follow-up).
12. CLI bare `fetch`/`seed` defaults to utah while blank workflow dispatch means all — consider requiring `--school`/`--all` once school #2 is live.
13. DB-level invariant for plan↔program university match (trigger or RLS `with check`) — action-layer guard is one of two write paths; PostgREST PATCH bypasses it (self-harm-only blast radius; document if accepted).
14. `migrateGuestPlan` accepts unbounded plan `name` — add a length cap.

## Acceptance Criteria

- [ ] Triage each; fix or explicitly accept with a note

## Work Log

- 2026-06-11: Synthesized from PR #8 review agents.
