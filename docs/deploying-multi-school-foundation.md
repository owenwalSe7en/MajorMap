# Deploying the Multi-School Foundation (PR #8)

Go/No-Go checklist produced by the deployment-verification review. Hard
ordering: **reconcile migration history → migrations → web deploy → Utah
re-seed → BYU seed → cron setup**. The new web is NOT compatible with the old
schema (it filters `is_discontinued`); migrations must land first.

## Stage 0 — migration history reconciliation (BLOCKING)

`todos/003` says the base schema may have been applied via the dashboard, so
the remote `schema_migrations` may be empty.

```powershell
supabase link --project-ref <PROJECT_REF>
supabase migration list
# If remote is empty but tables exist:
supabase migration repair --status applied 20260401000001
supabase migration repair --status applied 20260401000003
supabase migration repair --status applied 20260402000001
supabase migration repair --status applied 20260402000002
supabase migration repair --status applied 20260402000003
supabase db push --dry-run   # MUST list exactly the three 20260611* migrations
```

## Stage 1 — pre-deploy verification SQL (read-only)

```sql
-- 1a. Constraint names the migrations DROP must exist with these exact names
select t.relname, c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c join pg_class t on t.oid = c.conrelid
where t.relname in ('requirement_sets','plan_courses');
-- expect: requirement_sets_program_id_version_label_key (UNIQUE program_id, version_label)
--         plan_courses_course_id_fkey (FK ... ON DELETE CASCADE)
-- If named differently: ALTER TABLE ... RENAME CONSTRAINT first.

-- 1c. Nothing about to be created already exists (partial-apply detection)
select table_name, column_name from information_schema.columns
where table_schema='public' and (table_name, column_name) in (
 ('requirement_sets','content_hash'),('semester_plans','university_id'),
 ('courses','is_discontinued'),('programs','is_discontinued'));  -- expect 0 rows

-- 1e. CRITICAL: Utah row must carry the deterministic uuid the web hardcodes
select id, id = '63b63f87-3a1d-58a9-b55d-c0d359823c77' as ok
from public.universities where slug='utah';   -- NO-GO if false

-- 1f. RESTRICT revalidation precondition
select count(*) from public.plan_courses pc
left join public.courses c on c.id = pc.course_id where c.id is null;  -- expect 0

-- 1g. Save baseline counts (courses, programs, requirement_sets[, active],
--     requirement_items, semester_plans, plan_courses)
```

## Stage 2 — ordered steps

1. `supabase db push`
2. Validate (Stage 3A)
3. **Backup** (mandatory — keep-1 retention makes the re-seed irreversible):
   ```sql
   create table public.backup_req_sets_20260611 as select * from public.requirement_sets;
   create table public.backup_req_items_20260611 as select * from public.requirement_items;
   alter table public.backup_req_sets_20260611 enable row level security;
   alter table public.backup_req_items_20260611 enable row level security;
   ```
4. Merge PR #8 → web deploys
5. Smoke test (Stage 3B)
6. `pnpm catalog:fetch --school=utah; pnpm catalog:seed --school=utah`
   (expect: all rule-bearing programs "updated" on this first run — no hashes
   exist yet; coverage > 80%; ~0 discontinued)
7. Validate (Stage 3C)
8. `pnpm catalog:fetch --school=byu; pnpm catalog:seed --school=byu`; record
   BYU parse coverage (universality proof point)
9. Validate (Stage 3D) incl. two-school collision spot check
10. GitHub setup:
    ```powershell
    gh api -X PUT repos/owenwalSe7en/MajorMap/environments/catalog-refresh
    gh api -X POST repos/owenwalSe7en/MajorMap/environments/catalog-refresh/deployment-branch-policies -f name=main
    gh secret set SUPABASE_SERVICE_ROLE_KEY --env catalog-refresh
    gh variable set NEXT_PUBLIC_SUPABASE_URL --body "https://<PROJECT_REF>.supabase.co"
    ```
11. `gh workflow run catalog-refresh -f school=utah` — expect
    "0 updated, N unchanged" (content-hash-skip proof; a second full flip =
    hash instability, NO-GO for unattended cron)

## Stage 3 — post-deploy validation

**3A after migrations:**

```sql
select program_id, count(*) from public.requirement_sets
where is_active group by program_id having count(*) <> 1;        -- 0 rows, forever
select count(*) from public.semester_plans where university_id is null;  -- 0
select confdeltype from pg_constraint where conname='plan_courses_course_id_fkey'; -- 'r'
select column_default from information_schema.columns
where table_name='requirement_sets' and column_name='is_active'; -- false
```

```powershell
curl.exe -s -X POST "https://<REF>.supabase.co/rest/v1/rpc/activate_requirement_sets" `
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" `
  -H "Content-Type: application/json" -d "{\"p_pairs\": []}"
# expect 42501 permission denied. 200/204 = NO-GO (revoke missing).
```

**3B after web deploy:** `/utah/programs` 200; `/programs` 307→`/utah/programs`;
`/programs/<slug>` 308; `/not-a-school` 404; new plan rows carry
`university_id` (prerequisite for the NOT NULL follow-up migration).

**3C after Utah re-seed:** zero active sets without `content_hash`; zero
inactive sets; one-active invariant holds; discontinued counts ~0.

**3D after BYU:** per-school inventory query (both schools populated); BYU id
= `f6ada4f1-aa22-552a-84e3-f95a642f3b8e`; Utah plan counts unchanged; a course
code present at both schools resolves to different rows per school; Utah
suggestions contain zero BYU courses.

## Stage 4 — rollback

- **Web**: Vercel instant rollback (old web works on the new schema; never
  drop columns while the new web is live).
- **Migrations**: reverse-order SQL (drop new indexes/columns/function,
  recreate `idx_courses_lookup`, restore `is_active default true`); restoring
  the CASCADE FK is deliberately NOT recommended.
- **Utah re-seed**: seed exited non-zero → nothing to do (failure handler
  cleaned its debris; old sets active). Seed succeeded but wrong → restore
  from the Stage-2 backup tables (utah-scoped delete + reinsert).
- **BYU**: `delete from universities where slug='byu'` cascades catalog rows;
  a RESTRICT error means a user already planned a BYU course — stop and
  decide deliberately.
- **Cron**: `gh workflow disable catalog-refresh`.

## Stage 5 — first two cron runs

Watch: both matrix legs green; run 2 mostly "unchanged" (hash stability);
discontinued counts single-digit (a "Refusing stale-marking" error is the
circuit breaker working — do NOT loosen the threshold); coverage within 5
points of deploy baseline; one-active-set query still 0 rows; anon RPC still
denied. GitHub silently disables the schedule after 60 days of repo
inactivity — set a reminder (~Aug 5, 2026) or add a keepalive.

Cleanup after run 2: drop the backup tables, close `todos/003`, schedule the
`semester_plans.university_id NOT NULL` follow-up migration.
