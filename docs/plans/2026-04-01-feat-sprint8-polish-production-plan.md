---
title: "Sprint 8: Polish and Production Readiness"
type: feat
date: 2026-04-01
dependencies: "All prior sprints (1-7)"
---

# Sprint 8: Polish and Production Readiness

## Overview

Final sprint before public launch. Focus on loading states, error handling, SEO, accessibility, performance, documentation, and end-to-end test coverage. No new features -- only polish and hardening.

## Technical Approach

### 1. Skeleton Loading States

Add skeleton placeholders for every data-fetching page to eliminate layout shift.

- Program browse grid: skeleton cards (gray rectangles matching card dimensions)
- Planner page: skeleton semester columns with placeholder course slots
- Progress dashboard: skeleton progress bars and stat cards
- Compare page: skeleton side-by-side panels

Use MUI's built-in `<Skeleton>` component (already included with @mui/material). No custom component needed.

**Files:**

- `apps/web/app/programs/loading.tsx` (new -- Next.js loading convention)
- `apps/web/app/planner/loading.tsx` (new)
- `apps/web/app/compare/loading.tsx` (new)

### 2. Error Boundaries

Add error boundaries with friendly fallback UI for each route segment.

- Generic `ErrorFallback` component: illustration, message, "Try Again" button
- Per-route `error.tsx` files (Next.js convention) for programs, planner, compare
- Global `app/error.tsx` as catch-all
- Log errors to console in development (defer external error tracking -- YAGNI)

**Files:**

- `apps/web/app/components/ui/ErrorFallback.tsx` (new)
- `apps/web/app/error.tsx` (new)
- `apps/web/app/programs/error.tsx` (new)
- `apps/web/app/planner/error.tsx` (new)
- `apps/web/app/compare/error.tsx` (new)

### 3. SEO and Metadata

- Root `metadata` export in `app/layout.tsx`: title template, description, Open Graph defaults
- Per-page `generateMetadata` for dynamic titles (e.g., "CS BS Requirements | MajorMap")
- `app/sitemap.ts` generating sitemap.xml from programs table
- `app/robots.ts` with standard allow/disallow rules
- Open Graph image: static `opengraph-image.png` in `app/` directory

**Files:**

- `apps/web/app/layout.tsx` (edit -- add metadata)
- `apps/web/app/programs/[slug]/page.tsx` (edit -- add generateMetadata)
- `apps/web/app/sitemap.ts` (new)
- `apps/web/app/robots.ts` (new)
- `apps/web/app/opengraph-image.png` (new -- static asset)

### 4. Accessibility Audit

Systematic pass through all interactive components:

- Keyboard navigation: all interactive elements focusable, logical tab order, Escape closes modals
- ARIA: labels on icon-only buttons, `role` and `aria-expanded` on dropdowns, live regions for toast notifications
- Color contrast: verify all text meets WCAG AA (4.5:1 for normal text, 3:1 for large)
- Focus indicators: visible focus rings on all interactive elements (MUI's built-in focus styling)
- Screen reader: test with VoiceOver/NVDA on key flows (browse programs, plan courses, import transcript)

No new files -- edits across existing components. Document findings and fixes in PR description.

### 5. Performance

- Run `next build` and analyze bundle with `@next/bundle-analyzer`
- Dynamic imports for heavy components: TranscriptImportModal, ComparisonView, WhatIfView
- Verify images use `next/image` with appropriate sizing
- Check Supabase queries have proper indexes (already done in Sprint 1 migration)
- Add `<link rel="preconnect">` for Supabase API domain in layout

**Files:**

- `apps/web/next.config.ts` (edit -- add bundle analyzer config)
- `apps/web/app/planner/components/TranscriptImportModal.tsx` (edit -- dynamic import)
- `apps/web/app/compare/page.tsx` (edit -- dynamic imports for heavy views)
- `apps/web/app/layout.tsx` (edit -- preconnect link)

### 6. Documentation

- Final README: project description, screenshots, prerequisites, setup instructions, architecture overview, deployment, contributing guide, license
- Deployment docs: Vercel setup, Supabase project config, environment variables, seed instructions

**Files:**

- `README.md` (edit -- final version)
- `docs/deployment.md` (new)

### 7. E2E Tests with Playwright

Smoke tests and critical flow coverage. Keep the test suite small and focused on high-value paths.

```typescript
// e2e/tests/smoke.spec.ts        -- homepage loads, navigation works
// e2e/tests/programs.spec.ts     -- browse programs, view program detail
// e2e/tests/planner.spec.ts      -- add course to semester, drag reorder, view progress
// e2e/tests/auth.spec.ts         -- sign in, sign out, protected route redirect
```

- Use Playwright test fixtures for authenticated state (save auth cookie)
- Seed test data via Supabase service role in `globalSetup`
- Run against local Next.js dev server in CI

**Files:**

- `e2e/playwright.config.ts` (new)
- `e2e/tests/smoke.spec.ts` (new)
- `e2e/tests/programs.spec.ts` (new)
- `e2e/tests/planner.spec.ts` (new)
- `e2e/tests/auth.spec.ts` (new)
- `e2e/global-setup.ts` (new)
- `package.json` (edit -- add `test:e2e` script)
- `.github/workflows/ci.yml` (edit -- add Playwright step)

---

## Acceptance Criteria

- [ ] All data-fetching pages show skeleton loading states (no blank screens)
- [ ] Error boundaries catch and display friendly messages for all route segments
- [ ] `next build` completes without warnings
- [ ] Lighthouse SEO score >= 90
- [ ] Lighthouse Accessibility score >= 90
- [ ] All interactive elements keyboard-accessible with visible focus indicators
- [ ] Bundle size: no single route chunk exceeds 200KB gzipped
- [ ] Playwright smoke tests pass in CI
- [ ] E2E covers: browse programs, plan a course, import transcript, auth flow
- [ ] README accurately describes setup, architecture, and deployment
- [ ] `sitemap.xml` and `robots.txt` accessible at expected URLs

## Files to Modify

- **New:** `apps/web/app/components/ui/Skeleton.tsx`
- **New:** `apps/web/app/components/ui/ErrorFallback.tsx`
- **New:** `apps/web/app/error.tsx`, `apps/web/app/programs/error.tsx`, `apps/web/app/planner/error.tsx`, `apps/web/app/compare/error.tsx`
- **New:** `apps/web/app/programs/loading.tsx`, `apps/web/app/planner/loading.tsx`, `apps/web/app/compare/loading.tsx`
- **New:** `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`
- **New:** `docs/deployment.md`
- **New:** `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/tests/*.spec.ts`
- **Edit:** `apps/web/app/layout.tsx` (metadata, preconnect)
- **Edit:** `apps/web/next.config.ts` (bundle analyzer)
- **Edit:** `README.md`
- **Edit:** `package.json` (test:e2e script)
- **Edit:** `.github/workflows/ci.yml` (Playwright CI step)
