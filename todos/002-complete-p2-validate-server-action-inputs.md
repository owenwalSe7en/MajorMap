---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, security]
---

## Problem Statement

Server actions in `apps/web/src/app/plans/actions.ts` don't validate input parameters. `addSemester` accepts any string for `term` and any number for `year`. `migrateGuestPlan` trusts the full `GuestPlan` object from the client. DB CHECK constraints catch invalid values but produce unfriendly errors.

## Proposed Solutions

1. **Add input validation at the top of each server action** — Validate `term` is one of Fall/Spring/Summer, `year` is 2020-2040, `name` is non-empty string, IDs are UUID format.

## Acceptance Criteria

- [ ] `addSemester` validates term and year before DB insert
- [ ] `migrateGuestPlan` validates guest plan structure
- [ ] Invalid input returns user-friendly error messages
