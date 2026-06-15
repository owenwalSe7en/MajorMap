---
status: pending
priority: p2
issue_id: 014
tags: [code-review, testing, runtime]
dependencies: []
---

# Browser-verify PR #8 once Supabase env is configured

## Problem Statement

The LFG pipeline's browser-test and feature-video steps for PR #8 could not
run: this machine has no `.env` / `apps/web/.env.local` (no
`NEXT_PUBLIC_SUPABASE_URL` or anon key), and every route — including the
landing page via the session middleware — requires the Supabase client, so a
dev server would only serve 500s. Unit/integration coverage is green (228
tests), but no real browser pass has been done.

## Verification checklist (run with creds + migrations applied + Utah re-seeded)

```
npm install -g agent-browser && agent-browser install
corepack pnpm dev   # in background
```

- [ ] `/` renders; nav links point at `/utah/programs` and `/utah/courses`
- [ ] `/utah/programs` paginates (Showing X–Y of 593); `?page=25` works; out-of-range `?page=9999` redirect-clamps
- [ ] `/utah/courses?q=CS 3500` finds the course by code; injection probe `?q=x,id.not.is.null` returns normal results
- [ ] `/programs` 307-redirects and `/programs/<slug>` 308-redirects to `/utah/...`
- [ ] `/not-a-school/programs` and `/utah/programs/not-a-real-slug` show the branded 404
- [ ] Program detail renders a requirement tree incl. free_text "see catalog" badges (post re-seed)
- [ ] Signed in: plan page shows the Program picker; set/change/clear works; suggestions appear for a program with requirements; "Requirements … aren't available yet" for one without
- [ ] No console errors on any of the above

## Work Log

- 2026-06-12: Created during the PR #8 pipeline — browser steps skipped (no Supabase credentials in this environment).
