---
title: "Sprint 5: Transcript Import"
type: feat
date: 2026-04-01
dependencies: "Sprint 4 (progress engine)"
---

# Sprint 5: Transcript Import

## Overview

Students can paste an unofficial transcript to auto-mark completed courses. The parser extracts course codes, grades, and credits from plain text (UofU unofficial transcript format), matches them against the courses table, and marks matched courses as completed in the student's plan. Completed courses are visually distinguished in the planner.

## Technical Approach

### 1. Transcript Parser

Create a parser that accepts pasted plain text and extracts structured course data using regex matching.

```typescript
// packages/catalog/src/transcript/parser.ts
interface ParsedCourse {
  subjectCode: string; // "CS"
  number: string; // "3500"
  grade: string; // "A", "B+", "CR", etc.
  credits: number; // 3.0
  title?: string; // "Software Practice" (if present)
}

// Regex pattern for UofU transcript lines like "CS 3500  Software Practice  3.00  A"
const COURSE_LINE = /^([A-Z]{2,5})\s+(\d{4}[A-Z]?)\s+(.+?)\s+(\d+\.\d{2})\s+([A-Z][+-]?|CR|P|W|I)$/;
```

- Parse line-by-line, skip headers/footers/GPA summary lines
- Return array of `ParsedCourse` plus metadata (total credits parsed, unmatched lines count)
- Validate with Zod schema before returning

**File:** `packages/catalog/src/transcript/parser.ts` (new)

### 2. Course Matching

Match parsed course codes against the `courses` table by `subject_code` + `number`.

```typescript
// packages/catalog/src/transcript/matcher.ts
// - Query courses table: WHERE subject_code = $1 AND number = $2 AND university_id = $3
// - Return matched courses with their UUIDs + any unmatched codes
// - Log warnings for unmatched courses (transferred credits, deprecated codes)
```

**File:** `packages/catalog/src/transcript/matcher.ts` (new)

### 3. API Route

Single API route that accepts pasted text, parses, matches, and returns results for preview.

```typescript
// apps/web/app/api/transcript/parse/route.ts
// POST { text: string, universityId: string }
// Returns { matched: MatchedCourse[], unmatched: string[], totalCredits: number }
```

Auth required (user must be logged in). No file upload -- paste only (YAGNI).

**File:** `apps/web/app/api/transcript/parse/route.ts` (new)

### 4. Import UI

Paste modal with three steps: paste, preview, confirm.

- Paste step: textarea with placeholder showing expected format
- Preview step: table of parsed courses, matched (green) vs unmatched (gray), checkboxes to include/exclude
- Confirm step: summary of courses to mark complete, confirm button

Use a dialog component. Trigger from planner page via "Import Transcript" button.

**Files:**

- `apps/web/app/planner/components/TranscriptImportModal.tsx` (new)
- `apps/web/app/planner/components/TranscriptPreviewTable.tsx` (new)

### 5. Mark Courses as Completed

On confirm, update `plan_courses` rows for matched courses: set `status = 'completed'`, store grade. If the course is not already in the plan, insert it as completed.

```typescript
// apps/web/app/api/transcript/import/route.ts
// POST { planId: string, courses: { courseId: string, grade: string, credits: number }[] }
// Upserts plan_courses with status = 'completed'
```

**File:** `apps/web/app/api/transcript/import/route.ts` (new)

### 6. Visual Distinction in Planner

Completed courses in the planner grid get:

- Muted background color (green-50 or similar)
- Checkmark icon overlay
- Grade badge displayed on the course card
- Completed courses are not draggable (locked in place)

**File:** `apps/web/app/planner/components/CourseCard.tsx` (edit -- add completed variant)

---

## Acceptance Criteria

- [ ] Pasting a UofU unofficial transcript correctly parses course codes, grades, and credits
- [ ] Parser handles common edge cases: repeated courses (keeps highest grade), withdrawn courses (W), credit/no-credit (CR)
- [ ] Matched courses shown in preview with match confidence
- [ ] Unmatched courses listed separately with clear messaging
- [ ] Confirming import marks courses as completed in plan
- [ ] Progress dashboard updates to reflect newly completed courses
- [ ] Completed courses visually distinct in planner (checkmark, muted style, grade badge)
- [ ] Re-importing a transcript is idempotent (does not duplicate completed entries)
- [ ] Parser unit tests cover: standard transcript, empty input, malformed lines, cross-listed courses

## Files to Modify

- **New:** `packages/catalog/src/transcript/parser.ts`
- **New:** `packages/catalog/src/transcript/matcher.ts`
- **New:** `packages/catalog/src/transcript/parser.test.ts`
- **New:** `apps/web/app/api/transcript/parse/route.ts`
- **New:** `apps/web/app/api/transcript/import/route.ts`
- **New:** `apps/web/app/planner/components/TranscriptImportModal.tsx`
- **New:** `apps/web/app/planner/components/TranscriptPreviewTable.tsx`
- **Edit:** `apps/web/app/planner/components/CourseCard.tsx`
- **Edit:** `apps/web/app/planner/page.tsx` (add Import Transcript button)
