---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, quality]
dependencies: []
---

# Fixture JSON files are very large (5.2KB total, raw API responses)

## Problem Statement
The fixture files contain full raw Coursedog API responses with many unnecessary fields (workflow participants, sync metadata, audit fields). This bloats the repo and makes tests harder to read.

## Findings
- `data/raw/fixtures/coursedog-courses-cs-sample.json` — 2251 lines
- `data/raw/fixtures/coursedog-programs-sample.json` — 2953 lines
- Tests only use a handful of fields from each fixture

## Proposed Solutions
1. Trim fixtures to only the fields used by schemas and normalizers
   - Effort: Small
   - Risk: Low — `.passthrough()` on schemas means missing fields are fine
2. Keep as-is for now — they're real API responses which is valuable for regression
   - Effort: None

## Acceptance Criteria
- [ ] Fixture files contain only fields referenced by CoursedogCourseSchema and CoursedogProgramSchema
