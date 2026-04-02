# Major Map

A free, open-source degree planning tool for college students. Browse university programs, plan semesters, track progress toward graduation.

Currently supports **University of Utah** catalog data.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
pnpm i
cp .env.example .env   # fill in Supabase + Coursedog credentials
```

## Development

```bash
pnpm dev              # start Next.js dev server
pnpm test             # run all tests
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
  apps/web/           Next.js 14 frontend (Vercel)
  packages/
    shared/           Shared types and constants
    catalog/          Data pipeline: Coursedog API -> Supabase
    planner/          Degree planning logic (pure functions)
  supabase/
    migrations/       Postgres schema (hosted on Supabase)
  data/
    raw/              Cached API responses (gitignored)
    normalized/       Processed JSON snapshots
```

## Tech Stack

- **Frontend:** Next.js 14, React 18, Material UI
- **Database:** Supabase (hosted Postgres + Auth)
- **Data Source:** Coursedog API (University of Utah catalog)
- **Testing:** Vitest
- **Deployment:** Vercel

## License

MIT
