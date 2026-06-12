# Onboarding a School

MajorMap ingests any university whose public catalog runs on Coursedog. There
is **no Coursedog discovery API** — onboarding is a short manual process with
a validation CLI, and every candidate goes through human review before it
ships. Nothing is auto-onboarded.

## 1. Find the school's Coursedog catalog

Signals that a school's catalog runs on Coursedog:

- The catalog site is hosted at `https://<label>.catalog.prod.coursedog.com/`
  or a custom domain (e.g. `catalog.byu.edu`) that CNAMEs to it.
- "Powered by Coursedog" in the page footer.
- Network requests from the catalog page hit `https://app.coursedog.com/api/v1/...`.

## 2. Extract the Coursedog school id

Open the catalog site, view the page source (or the Network tab), and find the
school id in the Nuxt payload / API calls. It appears in URLs like:

```
https://app.coursedog.com/api/v1/cm/<coursedogSchoolId>/courses/search/$filters?...
```

Conventions vary: PeopleSoft schools are usually `<name>_peoplesoft`
(`utah_peoplesoft`, `arizona_peoplesoft`); others are plain (`byu`).

## 3. Probe and validate

```bash
pnpm --filter @major-map/catalog exec tsx src/cli.ts probe <coursedogSchoolId> <catalog-origin>
# example:
pnpm --filter @major-map/catalog exec tsx src/cli.ts probe byu https://catalog.byu.edu
```

The probe fetches the school's catalog editions, resolves the current
effective-dated edition, checks the course count, and prints a ready-to-paste
`schools.json` entry. If it returns 403/429, **stop** — do not retry against
that host.

## 4. Register the school (two places, kept in sync by a test)

1. **`packages/catalog/schools.json`** — paste the probe's entry and fill in
   the official school name. `catalogId` is optional (the fetcher resolves the
   current edition live; a pin is only the fallback).
2. **`packages/shared/src/schools.ts`** — add `{ slug, name, universityId }`
   where `universityId` is `universityUuid(slug)` from
   `packages/catalog/src/uuid.ts`. The catalog test suite fails if the two
   lists drift.

Rules:

- **A slug is forever.** Course/program UUIDs derive from it (uuidv5);
  renaming a slug orphans every previously seeded row.
- Slugs must match `^[a-z0-9_-]{1,64}$` and must not collide with a static
  web route (`plans`, `compare`, `login`, …) — the zod schema enforces both.
- Removing a school from `schools.json` is currently unsupported (its data,
  routes, and sitemap entries would go permanently stale rather than away).

## 5. Fetch and seed

**Ordering matters:** the university-scoping migration
(`semester_plans.university_id`) and the scoped web deploy must be live before
any second school is seeded — the seed refuses non-`utah` slugs otherwise.

```bash
pnpm catalog:fetch --school=<slug>
pnpm catalog:seed --school=<slug>
```

Check the seed output: parse coverage (target: >80% of requirement leaves
resolved; the rest appear as visible free-text items) and the discontinued
counts. The weekly `catalog-refresh` workflow picks the school up
automatically from `schools.json` on its next run.

## 6. Verify

- `/<slug>/programs` and `/<slug>/courses` browse and paginate.
- A program detail page renders a requirement tree.
- Picking that school's program on a plan produces suggestions.
- Utah pages behave exactly as before.

## Etiquette and risk

These are undocumented internal Coursedog endpoints behind a soft header gate
— not a licensed API. Keep the built-in 200ms delays and backoff, identify
ourselves via the probe's User-Agent, treat 403/429 as a permanent stop, and
expect this access could change or close at any time. The weekly refresh
failing loudly is the early-warning system.
