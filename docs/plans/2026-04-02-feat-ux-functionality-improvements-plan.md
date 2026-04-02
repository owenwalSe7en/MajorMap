---
title: "UX & Functionality Improvements"
type: feat
date: 2026-04-02
dependencies: "All sprints (1-8)"
---

# UX & Functionality Improvements

## Audit Summary

Multi-agent UX and architecture critique identified 15 issues across the app. The most critical: programs stop at 'C' (limit(100)), no program picker, 404s on program pages, and no pagination anywhere.

## Prioritized Issues

### P0 — Critical (blocks core usage)

#### 1. Programs page shows only first 100 results
**File:** `apps/web/src/app/programs/page.tsx:31`
**Problem:** `query.limit(100)` with 593 programs means 83% of programs invisible. Alphabetically stops at 'C'.
**Fix:** Add pagination with page param, show total count ("Showing 1-50 of 593"), page navigation buttons. Remove hard limit, use `range()` for offset pagination.

#### 2. No program picker on plan page
**File:** `apps/web/src/app/plans/[id]/page.tsx`
**Problem:** `semester_plans.program_id` exists but there's no UI to set it. Suggestions panel, credit summary, and comparison all depend on having a program selected. Users see "Select a program" message but can't do anything about it.
**Fix:** Add a program picker component to the plan page header. Server action to update `program_id` on `semester_plans`. When set, suggestions and credit progress become functional.

#### 3. Merge BS/BA into "Majors", hide certificates
**File:** `apps/web/src/app/programs/page.tsx:54-66`
**Problem:** Filter dropdown exposes raw database values ("Bachelor of Science", "Graduate Certificate"). User wants simplified categories.
**Fix:** Map degree types to user-friendly labels: BS+BA → "Majors", Minor → "Minors", MS/PhD → "Graduate". Filter certificates from the default view.

#### 4. Program 404 errors
**File:** `apps/web/src/app/programs/[slug]/page.tsx:55-56`
**Problem:** No `not-found.tsx` pages anywhere. Default Next.js 404 is a dead end with no navigation. Slugs may not match if catalog is refreshed.
**Fix:** Add branded not-found.tsx pages with navigation back to listings. Add a global not-found.tsx.

### P1 — Important (significantly impacts usability)

#### 5. Courses page limited to 50 results with no pagination
**File:** `apps/web/src/app/courses/page.tsx:35`
**Problem:** Same as programs — `limit(50)` on 17,892 courses. No indication results are truncated.
**Fix:** Add pagination. Also add search-by-code (currently only searches title via `ilike("title", ...)`).

#### 6. No active nav state
**File:** `apps/web/src/app/layout.tsx`
**Problem:** No visual indicator of which page you're on in the nav. All links look the same.
**Fix:** Use `usePathname()` to highlight the active nav link.

#### 7. Course search only matches title, not code
**File:** `apps/web/src/app/courses/page.tsx:26`
**Problem:** Students search "CS 1400" but the query only does `ilike("title", ...)`. Should also match subject_code + number.
**Fix:** Use Supabase full-text search on the existing `search_vector` column, or add `.or()` to also match code.

#### 8. No breadcrumbs on detail pages
**Problem:** Program detail and course detail pages have no back navigation except browser back button.
**Fix:** Add breadcrumb trail: Programs > Computer Science BS.

### P2 — Should Fix (improves quality)

#### 9. Courses table not mobile-responsive
**File:** `apps/web/src/app/courses/page.tsx:69-108`
**Problem:** `<table>` with no responsive handling breaks on mobile.
**Fix:** Wrap in `overflow-x-auto` or switch to card layout on mobile.

#### 10. No "results count" messaging
**Problem:** Neither programs nor courses pages show "Showing X of Y results" or "No more results".
**Fix:** Add count query + display.

#### 11. Guest planner has no program association
**Problem:** Guest users can plan semesters but get no suggestions, no credit tracking against a program.
**Fix:** Allow guests to select a program (stored in localStorage). Show suggestions based on it.

#### 12. Search requires form submission (full page reload)
**Problem:** Programs and courses search uses `method="get"` form — every search is a server round-trip.
**Fix:** Add client-side debounced search with URL param sync (useSearchParams + router.push).

### P3 — Nice to Have

#### 13. No onboarding flow for new users
**Problem:** New students land on hero page with no guided path.
**Fix:** Add a "Get Started" wizard: pick your school → pick your major → start planning.

#### 14. Compare page not discoverable
**Problem:** Compare is a top-level nav item but most students won't use it unprompted.
**Fix:** Add "Compare with another program" CTA on program detail pages.

#### 15. Hero stats are hardcoded
**File:** `apps/web/src/components/landing/hero-section.tsx:137-148`
**Problem:** "593 programs", "17,892 courses" are hardcoded strings, not live counts.
**Fix:** Fetch counts from DB or accept as-is (they're close enough).

---

## Implementation Plan

### Phase 1: Fix Critical Data Issues (P0)

**1a. Programs pagination + category filter**
- Add `page` searchParam, compute `range()` offset
- Add total count query
- Map degree_type to categories: `{BS,BA} → "Majors"`, `Minor → "Minors"`, `{MS,PhD,etc} → "Graduate"`
- Hide certificates by default (add "Show all" toggle)
- Show "Showing 1-50 of 347 Majors" + pagination buttons

**1b. Program picker for plans**
- New component: `apps/web/src/app/plans/[id]/program-picker.tsx`
- Search programs, select one, calls server action to update `semester_plans.program_id`
- Shows current program name in plan header
- When set, suggestions panel and credit sidebar become functional

**1c. Not-found pages**
- `apps/web/src/app/not-found.tsx` — global branded 404
- `apps/web/src/app/programs/[slug]/not-found.tsx` — "Program not found, browse all programs"
- `apps/web/src/app/courses/[code]/not-found.tsx` — "Course not found, search courses"

### Phase 2: Fix Important UX Issues (P1)

**2a. Courses pagination + code search**
- Same pagination pattern as programs
- Add OR condition to search: `textSearch("search_vector", query)` or `.or()` on code column

**2b. Active nav state**
- Convert header nav to a client component or use `usePathname()` in a NavLink wrapper

**2c. Breadcrumbs**
- Add breadcrumb component to detail pages

### Phase 3: Polish (P2-P3)

**3a. Mobile-responsive courses table**
**3b. Results count messaging**
**3c. Server action for program_id update**

---

## Files to Modify

### New Files
| File | Purpose |
|------|---------|
| `apps/web/src/app/not-found.tsx` | Global branded 404 |
| `apps/web/src/app/programs/[slug]/not-found.tsx` | Program 404 |
| `apps/web/src/app/courses/[code]/not-found.tsx` | Course 404 |
| `apps/web/src/app/plans/[id]/program-picker.tsx` | Program selector for plans |

### Edited Files
| File | Change |
|------|--------|
| `apps/web/src/app/programs/page.tsx` | Pagination, category filter, count display |
| `apps/web/src/app/courses/page.tsx` | Pagination, code search, mobile table |
| `apps/web/src/app/plans/[id]/page.tsx` | Program picker integration |
| `apps/web/src/app/plans/actions.ts` | Add `updatePlanProgram` server action |
| `apps/web/src/app/layout.tsx` | Active nav state |

## Acceptance Criteria

- [ ] All 593 programs browsable via pagination (not cut off at 'C')
- [ ] BS/BA merged into "Majors" filter; certificates hidden by default
- [ ] Program 404s show branded page with link back to listings
- [ ] Plan page has program picker; selecting a program enables suggestions
- [ ] Courses page paginates and searches by code
- [ ] Active nav link highlighted
- [ ] All new code has tests; all existing tests pass
