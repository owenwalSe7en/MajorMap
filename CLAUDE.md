# MajorMap — Development Guidelines

## Test-Driven Development (TDD) — REQUIRED

All new features MUST follow test-driven development:

1. **Write tests FIRST** based on the sprint plan/spec before writing any implementation code
2. **Tests should fail initially** — this confirms they test real behavior, not just pass trivially
3. **Implement the minimum code** to make tests pass
4. **Refactor** while keeping tests green

This applies to every sprint, every feature, every bug fix. No exceptions.

### Test Conventions

- Test files: `*.test.ts` colocated with source files
- Framework: Vitest (run from root: `pnpm test`)
- Use fixture data from `data/raw/fixtures/` for external API data
- Mock external services (Supabase, Coursedog API) in tests — never hit real APIs
- Test file naming matches source: `foo.ts` → `foo.test.ts`

## Code Style

- TypeScript strict mode everywhere
- ESM modules (`.js` import extensions in source)
- 2-space indentation, LF line endings
- Prettier for formatting (`pnpm format`)
- ESLint for linting (`pnpm -r lint`)

## Package Structure

- `packages/shared` — Types, constants (no runtime deps except zod)
- `packages/catalog` — Data pipeline (Coursedog API → Supabase)
- `packages/planner` — Pure computation (no DB, no side effects)
- `apps/web` — Next.js 14 frontend

## Database

- Supabase (hosted Postgres)
- Migrations in `supabase/migrations/`
- Service role key: CLI/seed scripts only, NEVER in client code
- RLS enabled on all tables
