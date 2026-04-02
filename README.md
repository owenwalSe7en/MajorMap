# MajorMap

A free, open-source degree planning tool for college students. Browse university programs, plan semesters, track progress toward graduation, import transcripts, and compare programs side-by-side.

Currently supports **University of Utah** catalog data.

## Features

- **Program Browsing** — Search and view degree requirements for any UofU program
- **Semester Planning** — Drag courses into semesters, get prerequisite warnings
- **Transcript Import** — Paste your unofficial transcript to auto-mark completed courses
- **Credit Tracking** — See completed vs. planned credits with progress bars
- **Course Suggestions** — AI-ranked recommendations based on remaining requirements and prereq chains
- **Program Comparison** — Side-by-side view of two programs with overlap analysis and what-if scenarios
- **Guest Mode** — Plan without signing up; migrate to account when ready

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (for database + auth)

## Setup

```bash
pnpm i
cp .env.example .env   # fill in Supabase credentials
```

## Development

```bash
pnpm dev              # start Next.js dev server
pnpm test             # run all tests (Vitest)
pnpm -r lint          # lint all packages
pnpm -r build         # build all packages
pnpm format           # format with Prettier
```

## Data Pipeline

```bash
pnpm catalog:fetch    # download raw catalog data from Coursedog API
pnpm catalog:seed     # normalize + upsert into Supabase
```

## Architecture

```
major-map/
  apps/web/             Next.js 14 frontend (Vercel)
  packages/
    shared/             Types, Zod schemas, constants (no runtime deps except zod)
    catalog/            Data pipeline: Coursedog API -> Supabase
    planner/            Pure computation (prereqs, credits, suggestions, comparison)
  supabase/
    migrations/         Postgres schema with RLS policies
  data/
    raw/                Cached API responses + test fixtures
```

### Package Boundaries

| Package | Responsibility | Dependencies |
|---------|---------------|-------------|
| `@major-map/shared` | Types, Zod schemas, constants | zod |
| `@major-map/catalog` | Coursedog API fetch, normalization, seeding | shared, supabase-js |
| `@major-map/planner` | Pure functions: prereqs, credits, suggestions, overlap | shared |
| `apps/web` | Next.js 14 App Router, Server Actions, UI | planner, shared |

### Database

- Supabase (hosted Postgres) with Row Level Security on all tables
- Migrations in `supabase/migrations/`
- Service role key: CLI/seed scripts only, never in client code

## Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS v4, Radix UI, shadcn/ui
- **Database:** Supabase (hosted Postgres + Auth + RLS)
- **Data Source:** Coursedog API (University of Utah catalog)
- **State:** Server Components + Server Actions (no client state library for data)
- **Testing:** Vitest + Testing Library (106+ unit/component tests)
- **Deployment:** Vercel

## License

MIT
