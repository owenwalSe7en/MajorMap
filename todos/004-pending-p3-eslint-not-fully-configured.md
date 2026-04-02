---
status: done
priority: p3
issue_id: "004"
tags: [code-review, tooling]
dependencies: []
---

# ESLint root config may not lint all packages correctly

## Problem Statement

The root `eslint.config.mjs` uses a single config for all packages. It does not have `parserOptions.project` set, which means type-aware ESLint rules (like `no-floating-promises`) won't work. Additionally, `pnpm -r lint` in each package runs `tsc --noEmit` but not `eslint` (lint scripts were not updated to include eslint).

## Findings

- `eslint.config.mjs` — basic recommended + typescript-eslint, no type-aware rules
- `packages/catalog/package.json:lint` — `"tsc -p tsconfig.json --noEmit"` (no eslint)
- Root has eslint installed but individual packages don't invoke it

## Proposed Solutions

1. Update per-package lint scripts to run `npx eslint . &&` before `tsc --noEmit`
   - Effort: Small
2. Add a root-level `lint:eslint` script that runs eslint across the whole repo
   - Effort: Small

## Acceptance Criteria

- [x] `pnpm -r lint` runs both eslint and TypeScript type checking
