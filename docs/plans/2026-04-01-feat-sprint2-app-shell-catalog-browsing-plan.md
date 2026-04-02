---
title: "Sprint 2: App Shell and Catalog Browsing"
type: feat
date: 2026-04-01
revised: true
review-feedback: Simplicity reviewer applied
dependencies: Sprint 1 complete (seeded Supabase database with ~18,570 courses, ~593 programs)
---

# Sprint 2: App Shell and Catalog Browsing

## Review Feedback Applied

- **Cut browser Supabase client** — zero client-side queries in Sprint 2; create when needed
- **Cut custom EmotionCache.tsx** — use `@mui/material-nextjs` official adapter or test without it first
- **Cut MuiChip/MuiTableCell theme overrides** — inline at usage site if needed
- **Replaced 4 custom skeleton loading.tsx** with 1 generic loading indicator (MUI CircularProgress)
- **Cut credits filter on /courses** — keep only text search + department filter for MVP
- **Simplified FilterForm** — use plain `<form method="get">` with submit button (Server Component), not a client component with auto-submit
- **Cut Zod schemas from shared** — use TypeScript types derived from Supabase `Database` generic, not parallel Zod schemas
- **Simplified prerequisite display** — flat list of linked course names, not AND/OR grouped rendering; defer complex grouping to later sprint
- **~20-25% LOC reduction** from original plan

## Overview

Transform the stub Next.js app into a styled, navigable web application where users can browse University of Utah programs, view requirement trees, and search courses -- all backed by real Supabase data seeded in Sprint 1. At the end of this sprint, a user can visit the app, search for "Computer Science", drill into the BS program to see its requirement tree, and search/view individual courses with prerequisites and credit info.

**Scope boundary:** Read-only catalog browsing only. No auth, no planner, no user state, no write operations.

---

## Technical Approach

### Phase 1: Theme, Dependencies, and Shared Package Updates

#### 1.1 New Dependencies for `apps/web`

```json
{
  "dependencies": {
    "@mui/material": "^5",
    "@mui/icons-material": "^5",
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@supabase/ssr": "^0.5",
    "@supabase/supabase-js": "^2",
    "@major-map/shared": "workspace:*"
  }
}
```

Use `@supabase/ssr` (not `@supabase/auth-helpers-nextjs`) for creating server-side and browser Supabase clients. This is the current recommended approach for Next.js App Router.

**Why `@supabase/ssr` instead of raw `@supabase/supabase-js`?** It handles cookie-based client creation for Server Components without auth. Even though we have no auth in Sprint 2, this avoids a migration later. The anon key is sufficient for all catalog reads (RLS policies from Sprint 1 grant `anon` SELECT on all catalog tables).

#### 1.2 MUI Theme

```typescript
// apps/web/src/theme.ts
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#CC0000" }, // Utah crimson
    secondary: { main: "#4A4A4A" },
    text: {
      primary: "#1A1A1A",
      secondary: "#6B6B6B",
    },
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: "2rem", fontWeight: 600 },
    h2: { fontSize: "1.5rem", fontWeight: 600 },
    h3: { fontSize: "1.25rem", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #E5E5E5" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #E5E5E5" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#E5E5E5" },
      },
    },
  },
});
```

Design principles:

- **No elevation shadows** -- subtle `#E5E5E5` borders only (Linear-style)
- **Compact density** -- no oversized padding
- **System font stack** -- fast load, native feel
- **Utah crimson `#CC0000` as primary** -- used sparingly for links and accents. For body text on white, the 4.63:1 contrast ratio passes WCAG AA for normal text. For small text or non-essential decoration, we mute to `#A00000` (7.04:1) where needed.
- **Dark mode deferred** -- `prefers-color-scheme` media query support is a Sprint 3+ concern. Sprint 2 ships light mode only to keep scope tight.

#### 1.3 Shared Package: Major to Program Rename

Sprint 1 deferred this rename. Sprint 2 is the first real consumer of shared types in the web app, so the rename happens now.

```typescript
// packages/shared/src/schema.ts — updated
import { z } from "zod";

// -- Catalog display types (used by web app) --

export const DEGREE_TYPES = ["BS", "BA", "Minor", "Certificate", "MS", "PhD"] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];

export const ProgramSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  degreeType: z.enum(DEGREE_TYPES),
  description: z.string().default(""),
  totalCredits: z.number().nullable().default(null),
  sourceUrl: z.string().url().optional(),
});

export type Program = z.infer<typeof ProgramSchema>;

export const CourseSchema = z.object({
  id: z.string().uuid(),
  subjectCode: z.string().min(1),
  number: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  creditsMin: z.number(),
  creditsMax: z.number(),
});

export type Course = z.infer<typeof CourseSchema>;

export const RequirementItemSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number(),
  label: z.string(),
  type: z.enum(["group", "course", "elective_slot", "freetext"]),
  courseId: z.string().uuid().nullable().default(null),
  creditsRequired: z.number().nullable().default(null),
  coursesRequired: z.number().nullable().default(null),
  description: z.string().nullable().default(null),
});

export type RequirementItem = z.infer<typeof RequirementItemSchema>;
```

Remove `MajorSchema`, `Major`, `EvaluationSchema`, `Evaluation`, `EvaluationStateSchema` -- those belong in their respective sprint packages. Keep `RequirementItemSchema` (used by program detail page). Remove the parse helper functions (consumers can call `.parse()` directly).

Update `packages/shared/src/index.ts`:

```typescript
export * from "./schema.js";
export type { DegreeType, Program, Course, RequirementItem } from "./schema.js";
```

**Breaking change:** `MajorId` type alias and `MajorSchema` are removed. No current consumers (catalog package uses Coursedog raw schemas and Supabase generated types, not shared schemas).

#### 1.4 Next.js ESLint Config

Sprint 1 noted this was deferred. Add Next.js-specific linting now:

```json
// apps/web/package.json — update lint script
{
  "scripts": {
    "lint": "next lint && tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "eslint-config-next": "14.2.5"
  }
}
```

```json
// apps/web/.eslintrc.json
{
  "extends": "next/core-web-vitals"
}
```

---

### Phase 2: App Shell and Supabase Client

#### 2.1 Supabase Client Setup

Two clients: one for Server Components (reads cookies for future auth), one for browser-side use.

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@major-map/catalog/types/database";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
```

```typescript
// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@major-map/catalog/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Environment variables (`.env.local`, not committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Add `.env.local.example` with placeholder values.

**Note:** The `Database` type is auto-generated by `supabase gen types typescript` after Sprint 1 migration. Import it from the catalog package where it lives. If the catalog package does not export it yet, add a `types/database.ts` export.

#### 2.2 App Shell Layout

Replace the stub `layout.tsx` with MUI-powered app shell:

```typescript
// apps/web/src/app/layout.tsx
// - Wraps children in MUI ThemeProvider + CssBaseline
// - Top navigation bar with:
//   - "MajorMap" logo/text (links to /)
//   - "Programs" nav link (links to /programs)
//   - "Courses" nav link (links to /courses)
// - Responsive: hamburger menu on mobile (< 600px)
// - Uses AppBar with position="sticky", no elevation, bottom border only
// - Content area with maxWidth container (lg = 1200px)
// - Footer deferred (YAGNI for Sprint 2)
```

MUI + Next.js App Router integration requires a client component wrapper for ThemeProvider:

```typescript
// apps/web/src/components/ThemeRegistry.tsx
"use client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/theme";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
```

```typescript
// apps/web/src/components/AppNav.tsx
"use client";
// - MUI AppBar, Toolbar, Button, IconButton, Drawer
// - Desktop: horizontal nav links
// - Mobile (<600px): hamburger icon -> Drawer with vertical nav links
// - Active route highlighted via usePathname()
// - No auth UI (Sprint 2 scope)
```

The layout itself remains a Server Component; only ThemeRegistry and AppNav are client components.

#### 2.3 Emotion + MUI SSR Configuration

MUI v5 with Next.js App Router requires Emotion cache configuration to avoid style flickering:

```typescript
// apps/web/src/components/EmotionCache.tsx
"use client";
// - createCache from @emotion/cache
// - CacheProvider from @emotion/react
// - useServerInsertedHTML for SSR style injection
// Standard MUI + Next.js App Router pattern
```

ThemeRegistry wraps EmotionCache + ThemeProvider + CssBaseline.

---

### Phase 3: Catalog Pages

All catalog pages are **React Server Components** (no `"use client"` directive). Data is fetched at request time using the Supabase server client. No client-side state management needed -- this is read-only catalog data.

#### 3.1 Landing Page (`/`)

```typescript
// apps/web/src/app/page.tsx
// Server Component
// - Hero section: "Find your path" heading, subtext about U of U programs
// - Program search box: text input that navigates to /programs?q={query}
//   (simple form with action, no client JS needed)
// - Quick stats: course count, program count (fetched from Supabase .count())
// - Quick links: "Browse Programs", "Search Courses" as Card links
// - Clean, minimal layout -- no carousel, no marketing fluff
```

The search input uses a `<form>` with `action="/programs"` and a `name="q"` input -- pure HTML form submission, zero client JS. This is the simplest possible implementation that works with Server Components.

#### 3.2 Program Explorer (`/programs`)

```typescript
// apps/web/src/app/programs/page.tsx
// Server Component
// Props: searchParams — { q?: string; degreeType?: string; department?: string }

// Data fetching:
//   const supabase = createClient();
//   let query = supabase.from("programs").select("id, slug, name, degree_type, description, total_credits")
//     .eq("university_id", UTAH_UNIVERSITY_ID)
//     .order("name");
//   if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);
//   if (searchParams.degreeType) query = query.eq("degree_type", searchParams.degreeType);

// UI:
// - Page title "Programs"
// - Filter bar: text search input, degree type dropdown (BS, BA, Minor, Certificate, MS, PhD)
//   Filters use form submission to update URL searchParams (server-side filtering)
// - Results: Card list with program name, degree type chip, description preview
// - Each card links to /programs/{slug}
// - Empty state: "No programs found" message
// - Result count shown: "Showing X programs"
```

**Filter implementation:** All filtering happens via URL search params and Supabase server-side queries. No client-side filtering. The filter form uses HTML form submission (`method="get"`) to reload the page with updated params. This keeps the page a pure Server Component.

For the degree type filter, use a small client component wrapping a `<select>` that submits the form on change:

```typescript
// apps/web/src/components/FilterForm.tsx
"use client";
// - Text input for search (name="q")
// - Select dropdown for degreeType (name="degreeType")
// - Auto-submits on select change via form.submit()
// - Preserves existing query params
```

#### 3.3 Program Detail (`/programs/[slug]`)

```typescript
// apps/web/src/app/programs/[slug]/page.tsx
// Server Component
// Params: { slug: string }

// Data fetching:
//   1. Fetch program by slug (with university_id)
//   2. Fetch active requirement_set for this program (is_active = true)
//   3. Fetch all requirement_items for that set, ordered by sort_order
//   4. Build tree in memory from flat list using parent_id

// UI:
// - Breadcrumb: Programs > {program name}
// - Program header: name, degree type chip, total credits, description
// - Requirements tree:
//   - Collapsible groups (Accordion or custom tree)
//   - Course items show: code, title, credits
//   - Elective slots show: label, credits required
//   - Freetext items show: description
// - 404 page if slug not found (notFound() from next/navigation)
```

**Tree building:** The `requirement_items` table uses `parent_id` for hierarchy. Fetch all items for the set as a flat array, then build the tree in a single pass:

```typescript
// apps/web/src/lib/requirements-tree.ts
interface RequirementNode {
  item: RequirementItem;
  children: RequirementNode[];
}

function buildTree(items: RequirementItem[]): RequirementNode[] {
  const map = new Map<string, RequirementNode>();
  const roots: RequirementNode[] = [];

  // First pass: create nodes
  for (const item of items) {
    map.set(item.id, { item, children: [] });
  }

  // Second pass: link parent-child
  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
```

**Requirement tree UI component:**

```typescript
// apps/web/src/components/RequirementTree.tsx
// Server Component (no interactivity needed for MVP)
// - Renders tree recursively
// - Groups: bold label, indented children, optional credits/courses required badge
// - Courses: link to /courses/{code}, show credits
// - Elective slots: muted text, credits required
// - Freetext: italic description
// - Indentation via left margin (16px per level)
// - No collapse/expand in Sprint 2 (YAGNI -- tree is fully expanded)
//   If requirement trees are too deep, add collapse in Sprint 3
```

#### 3.4 Course Search (`/courses`)

```typescript
// apps/web/src/app/courses/page.tsx
// Server Component
// Props: searchParams — { q?: string; department?: string; credits?: string }

// Data fetching:
//   let query = supabase.from("courses")
//     .select("id, subject_code, number, code, title, credits_min, credits_max, department_id")
//     .eq("university_id", UTAH_UNIVERSITY_ID)
//     .order("subject_code").order("number")
//     .limit(50);
//   if (searchParams.q) {
//     // Use Postgres full-text search (index exists from Sprint 1)
//     query = query.textSearch("title_description_fts", searchParams.q, { type: "websearch" });
//   }
//   if (searchParams.department) query = query.eq("subject_code", searchParams.department);
//   if (searchParams.credits) query = query.lte("credits_min", Number(searchParams.credits))
//                                         .gte("credits_max", Number(searchParams.credits));

// UI:
// - Page title "Courses"
// - Search bar: text input (name="q")
// - Filters: department/subject code dropdown, credit hours dropdown
// - Results: table with columns: Code, Title, Credits
//   Each row links to /courses/{code}
// - Pagination: "Load more" is YAGNI -- limit to 50 results with message
//   "Showing first 50 results. Refine your search for more specific results."
// - Empty state: "No courses found"
```

**Full-text search note:** Sprint 1 created a GIN index on `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`. To use Supabase's `.textSearch()`, we need a generated column or to use `.or()` with `ilike` as fallback. The simpler approach for Sprint 2:

```typescript
// If search query exists, use ilike on title (simple, good enough for MVP)
if (searchParams.q) {
  query = query.ilike("title", `%${searchParams.q}%`);
}
```

Full-text search with `textsearch` can be added as an enhancement if `ilike` is too slow. With the existing GIN index and ~18K courses, `ilike` on `title` should be acceptable for Sprint 2.

#### 3.5 Course Detail (`/courses/[code]`)

```typescript
// apps/web/src/app/courses/[code]/page.tsx
// Server Component
// Params: { code: string } — e.g. "CS3500"

// Data fetching:
//   1. Parse code into subject_code + number (e.g. "CS" + "3500")
//      Regex: /^([A-Z]+)\s*(\d+\w*)$/
//   2. Fetch course by subject_code + number + university_id
//   3. Fetch prerequisites: course_prerequisites where course_id = this course
//      Join prerequisite_course_id to get prereq course code + title
//   4. 404 if not found

// UI:
// - Breadcrumb: Courses > {code}
// - Course header: code, title, credits (show range if min != max)
// - Description paragraph
// - Prerequisites section:
//   - If no prereqs: "None"
//   - Group by group_id, show group_operator (AND/OR)
//   - Each prereq: link to /courses/{code}, min grade if applicable
//   - Corequisites labeled separately
// - Metadata: subject code, department (if available)
```

**Code parsing:** The URL param `[code]` is a concatenated code like `CS3500`. Split into subject + number:

```typescript
// apps/web/src/lib/parse-course-code.ts
export function parseCourseCode(code: string): { subjectCode: string; number: string } | null {
  const match = code.match(/^([A-Z]+)\s*(\d+\w*)$/i);
  if (!match) return null;
  return { subjectCode: match[1].toUpperCase(), number: match[2] };
}
```

#### 3.6 Constants

```typescript
// apps/web/src/lib/constants.ts
// University of Utah's deterministic UUID (from Sprint 1 seed)
// This avoids a lookup query on every page load
export const UTAH_UNIVERSITY_ID = "<uuid>"; // populated after Sprint 1 seed runs

// Alternatively, fetch once and cache:
// This is the safer approach if the UUID isn't hardcoded
export const UTAH_SLUG = "utah";
```

**Decision:** Use `UTAH_SLUG` and filter by slug joined to university, or do a single lookup per request. Since these are Server Components with no caching concerns, a simple `.eq("university_id", id)` filter is fine. For Sprint 2, hardcode the university UUID after the first seed run and document it. If multi-university support is needed later, refactor then.

---

### Phase 4: Loading and Error States

#### 4.1 Loading States

```typescript
// apps/web/src/app/programs/loading.tsx
// apps/web/src/app/programs/[slug]/loading.tsx
// apps/web/src/app/courses/loading.tsx
// apps/web/src/app/courses/[code]/loading.tsx
// Each exports a skeleton UI using MUI Skeleton components
// - Programs list: 6 card skeletons
// - Program detail: header skeleton + 4 tree item skeletons
// - Course list: table with 8 row skeletons
// - Course detail: header skeleton + description skeleton
```

#### 4.2 Error Boundaries

```typescript
// apps/web/src/app/programs/error.tsx
// apps/web/src/app/courses/error.tsx
"use client"; // error.tsx must be a client component
// - Display friendly error message
// - "Try again" button that calls reset()
// - Log error to console (no error reporting service in Sprint 2)
```

#### 4.3 Not Found Pages

```typescript
// apps/web/src/app/programs/[slug]/not-found.tsx
// apps/web/src/app/courses/[code]/not-found.tsx
// - "Program/Course not found" message
// - Link back to list page
```

---

## Acceptance Criteria

### Functional

- [ ] App loads at `localhost:3000` with styled MUI shell (nav bar, content area)
- [ ] Navigation between all pages works (/, /programs, /courses, /programs/[slug], /courses/[code])
- [ ] Landing page displays program search box, quick stats (course/program counts), and quick links
- [ ] `/programs` shows filterable list of programs from Supabase
- [ ] Program search by name works (text input filters results)
- [ ] Program filter by degree type works (dropdown filters results)
- [ ] `/programs/[slug]` shows program details with requirement tree
- [ ] Requirement tree renders hierarchically (groups with nested courses/elective slots)
- [ ] `/courses` shows searchable course list from Supabase
- [ ] Course search by title works
- [ ] Course filter by department/subject code works
- [ ] `/courses/[code]` shows course details with description, credits, and prerequisites
- [ ] Prerequisites display with group operators (AND/OR) and grade requirements
- [ ] Prerequisite course names link to their detail pages
- [ ] Invalid slugs/codes show 404 not-found page
- [ ] Mobile responsive: nav collapses to hamburger menu, content reflows

### Non-Functional

- [ ] All catalog pages are Server Components (no `"use client"` except ThemeRegistry, AppNav, FilterForm)
- [ ] No client-side data fetching (all Supabase queries in Server Components)
- [ ] Theme has zero elevation shadows (borders only)
- [ ] Primary color is Utah crimson `#CC0000`
- [ ] Text contrast passes WCAG AA (4.5:1 for body text)
- [ ] `pnpm -r build` succeeds
- [ ] `pnpm -r lint` passes
- [ ] No secrets in git (Supabase URL/key in `.env.local` only)

### Quality Gates

- [ ] Lighthouse accessibility score >= 90 on all pages
- [ ] No layout shift on page load (Emotion SSR configured correctly)
- [ ] Programs page loads in under 2 seconds with full dataset
- [ ] Course search returns results in under 1 second

---

## Files to Create

| File                                             | Purpose                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `apps/web/src/theme.ts`                          | MUI theme configuration                                |
| `apps/web/src/components/ThemeRegistry.tsx`      | Client wrapper for MUI ThemeProvider + CssBaseline     |
| `apps/web/src/components/EmotionCache.tsx`       | Emotion SSR cache for Next.js App Router               |
| `apps/web/src/components/AppNav.tsx`             | Top navigation bar (client component)                  |
| `apps/web/src/components/FilterForm.tsx`         | Search + filter form (client component)                |
| `apps/web/src/components/RequirementTree.tsx`    | Recursive requirement tree renderer (server component) |
| `apps/web/src/lib/supabase/server.ts`            | Supabase server client for RSC                         |
| `apps/web/src/lib/supabase/client.ts`            | Supabase browser client (for future use)               |
| `apps/web/src/lib/requirements-tree.ts`          | Tree builder from flat requirement_items               |
| `apps/web/src/lib/parse-course-code.ts`          | Parse "CS3500" into subject + number                   |
| `apps/web/src/lib/constants.ts`                  | University ID, slug constants                          |
| `apps/web/src/app/programs/page.tsx`             | Program explorer page                                  |
| `apps/web/src/app/programs/loading.tsx`          | Program list skeleton                                  |
| `apps/web/src/app/programs/error.tsx`            | Program list error boundary                            |
| `apps/web/src/app/programs/[slug]/page.tsx`      | Program detail page                                    |
| `apps/web/src/app/programs/[slug]/loading.tsx`   | Program detail skeleton                                |
| `apps/web/src/app/programs/[slug]/not-found.tsx` | Program not found                                      |
| `apps/web/src/app/courses/page.tsx`              | Course search page                                     |
| `apps/web/src/app/courses/loading.tsx`           | Course list skeleton                                   |
| `apps/web/src/app/courses/error.tsx`             | Course list error boundary                             |
| `apps/web/src/app/courses/[code]/page.tsx`       | Course detail page                                     |
| `apps/web/src/app/courses/[code]/loading.tsx`    | Course detail skeleton                                 |
| `apps/web/src/app/courses/[code]/not-found.tsx`  | Course not found                                       |
| `apps/web/.env.local.example`                    | Environment variable template                          |
| `apps/web/.eslintrc.json`                        | Next.js ESLint config                                  |

## Files to Edit

| File                            | Change                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| `apps/web/package.json`         | Add MUI, Emotion, Supabase, shared deps; update lint script         |
| `apps/web/src/app/layout.tsx`   | Replace stub with MUI shell (ThemeRegistry, AppNav, Container)      |
| `apps/web/src/app/page.tsx`     | Replace stub with landing page                                      |
| `apps/web/tsconfig.json`        | Add `@/` path alias for `src/`                                      |
| `packages/shared/src/schema.ts` | Major->Program rename, add RequirementItemSchema, remove Evaluation |
| `packages/shared/src/index.ts`  | Update exports (remove MajorId, add new types)                      |

---

## Page Structure

```
apps/web/src/
  app/
    layout.tsx                      -- MUI ThemeProvider, top nav, responsive shell
    page.tsx                        -- Landing page (hero, search, stats)
    programs/
      page.tsx                      -- Program explorer (filterable list)
      loading.tsx                   -- Skeleton loader
      error.tsx                     -- Error boundary
      [slug]/
        page.tsx                    -- Program detail (requirements tree)
        loading.tsx                 -- Skeleton loader
        not-found.tsx               -- 404
    courses/
      page.tsx                      -- Course search (text search, filters)
      loading.tsx                   -- Skeleton loader
      error.tsx                     -- Error boundary
      [code]/
        page.tsx                    -- Course detail (prereqs, credits)
        loading.tsx                 -- Skeleton loader
        not-found.tsx               -- 404
  components/
    ThemeRegistry.tsx               -- MUI + Emotion SSR setup
    EmotionCache.tsx                -- Emotion cache for App Router
    AppNav.tsx                      -- Top navigation (client component)
    FilterForm.tsx                  -- Search/filter form (client component)
    RequirementTree.tsx             -- Recursive tree renderer
  lib/
    supabase/
      server.ts                     -- createServerClient for RSC
      client.ts                     -- createBrowserClient for future use
    requirements-tree.ts            -- Build tree from flat items
    parse-course-code.ts            -- "CS3500" -> { subjectCode, number }
    constants.ts                    -- University ID, slugs
  theme.ts                          -- MUI theme config
```

---

## What This Sprint Does NOT Include

- **No auth** -- no login, no user accounts, no protected routes
- **No planner** -- no semester planning, no drag-and-drop
- **No user state** -- no saved programs, no progress tracking
- **No dark mode** -- light mode only (dark mode is a future enhancement)
- **No footer** -- not needed for MVP catalog browsing
- **No pagination** -- course search capped at 50 results with "refine search" message
- **No client-side caching** -- Server Components fetch fresh on each request (acceptable for catalog data)
- **No tests for web app** -- Component testing deferred to Sprint 3 when patterns stabilize. Sprint 2 is validated manually against acceptance criteria.
- **No Storybook** -- YAGNI for 6 pages
