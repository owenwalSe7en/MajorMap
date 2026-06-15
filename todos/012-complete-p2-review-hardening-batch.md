---
status: complete
priority: p2
issue_id: 012
tags: [code-review, quality, catalog, web, ci]
dependencies: []
---

# PR #8 review: P2 hardening batch

## Problem Statement

Seven P2 findings from the multi-agent review of PR #8, batched because each is a small, independent change.

## Findings

1. **Dead ternary / never-populated column** â€” [packages/catalog/src/normalizers/requirements.ts](../packages/catalog/src/normalizers/requirements.ts): `credits_required: condition === "completedAtLeastXOf" && ... ? null : null` â€” both branches null. Replace with `credits_required: null` (credit-based restrictions are not yet distinguishable in observed data; raw_rule retains them). (kieran P2-3, simplicity P1-1)
2. **Workflow secret over-exposure** â€” [.github/workflows/catalog-refresh.yml](../.github/workflows/catalog-refresh.yml): `SUPABASE_SERVICE_ROLE_KEY` is job-level env, present during install/build/fetch. Move it into the seed step's `env:` only. (security P2-2)
3. **Unordered pagination in stale diff** â€” [packages/catalog/src/seed.ts](../packages/catalog/src/seed.ts) `markDiscontinued` pages with `.range()` but no `.order()`; rows just rewritten by upsert can be skipped/duplicated, perturbing the circuit-breaker math. Add `.order("id")`. (data-integrity P2-1)
4. **ProgramPicker search robustness** â€” [apps/web/src/app/plans/[id]/program-picker.tsx](../apps/web/src/app/plans/%5Bid%5D/program-picker.tsx): AbortController never attached (`.abortSignal()`), query errors swallowed (silent "no results"), no debounce; test mock chain lacks `eq` so the search path is untested. (kieran P2-4/P2-5)
5. **universityId should be required** â€” [apps/web/src/lib/catalog-browse.ts](../apps/web/src/lib/catalog-browse.ts): optional-with-Utah-default contradicts the module's "can never be forgotten" rationale; a forgotten param silently scopes to Utah. Make it required. (simplicity P2-4)
6. **Three-way requirement row type** â€” `RequirementItemDraft` should derive from shared `RequirementItemRow` (`Omit<..., "requirement_set_id">`) so the "single definition" comment is true. (simplicity P2-5)
7. **Seed summary is an informal grep contract** â€” the workflow greps prose log lines; rewording silently empties the job summary. Emit stable `SUMMARY:`-prefixed lines (or JSON) and grep that. (agent-native P2-2)

## Acceptance Criteria

- [ ] Each item fixed with tests where applicable; full suite + lint green

## Work Log

- 2026-06-11: Synthesized from PR #8 review agents.
