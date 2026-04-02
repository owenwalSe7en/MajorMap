---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, security]
---

## Problem Statement

`apps/web/src/app/plans/[id]/add-course.tsx:49` interpolates user input directly into a PostgREST `.or()` filter string. While Supabase JS URL-encodes the values, special characters in the query could cause unexpected filter behavior.

## Findings

- Line 49: `.or(\`code.ilike.%${q}%,title.ilike.%${q}%\`)`
- User input `q` is not sanitized before interpolation
- PostgREST filter syntax uses commas and dots as delimiters

## Proposed Solutions

1. **Sanitize input** — Strip/escape PostgREST special characters (commas, parentheses, dots in filter context) before interpolating.
2. **Use `.ilike()` with separate filter calls** — Use `.or()` with individual filter objects instead of string interpolation.

## Acceptance Criteria

- [ ] Course search input is sanitized before query
- [ ] Special characters in search don't cause unexpected results
