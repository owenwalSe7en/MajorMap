-- Sprint 3: Plan tables for degree planning
-- 3 tables: semester_plans, plan_semesters, plan_courses
-- All with RLS using denormalized user_id and (select auth.uid()) for initPlan caching

-- 1. Semester plans (owned by a user)
-- No start_year/start_term — derive from MIN(year, term) of child semesters
create table public.semester_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  name text not null default 'My Plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Plan semesters (one row per semester slot)
-- No sort_order — order by (year, term)
create table public.plan_semesters (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.semester_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null check (term in ('Fall', 'Spring', 'Summer')),
  year integer not null check (year >= 2020 and year <= 2040),
  unique(plan_id, term, year)
);

-- 3. Plan courses (a course placed in a semester)
-- No plan_id — user_id is denormalized for RLS, plan_id is redundant
-- No sort_order — order by created_at
create table public.plan_courses (
  id uuid primary key default gen_random_uuid(),
  plan_semester_id uuid not null references public.plan_semesters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(plan_semester_id, course_id)
);

-- Enable RLS
alter table public.semester_plans enable row level security;
alter table public.plan_semesters enable row level security;
alter table public.plan_courses enable row level security;

-- RLS policies: (select auth.uid()) wrapped in subquery for Postgres initPlan caching
-- This prevents Postgres from calling auth.uid() per-row, yielding 100x+ improvement

-- semester_plans
create policy "users select own plans"
  on public.semester_plans for select
  to authenticated using (user_id = (select auth.uid()));

create policy "users insert own plans"
  on public.semester_plans for insert
  to authenticated with check (user_id = (select auth.uid()));

create policy "users update own plans"
  on public.semester_plans for update
  to authenticated using (user_id = (select auth.uid()));

create policy "users delete own plans"
  on public.semester_plans for delete
  to authenticated using (user_id = (select auth.uid()));

-- plan_semesters (denormalized user_id — no join needed in RLS)
create policy "users select own semesters"
  on public.plan_semesters for select
  to authenticated using (user_id = (select auth.uid()));

create policy "users insert own semesters"
  on public.plan_semesters for insert
  to authenticated with check (user_id = (select auth.uid()));

create policy "users update own semesters"
  on public.plan_semesters for update
  to authenticated using (user_id = (select auth.uid()));

create policy "users delete own semesters"
  on public.plan_semesters for delete
  to authenticated using (user_id = (select auth.uid()));

-- plan_courses (denormalized user_id — no join needed in RLS)
create policy "users select own courses"
  on public.plan_courses for select
  to authenticated using (user_id = (select auth.uid()));

create policy "users insert own courses"
  on public.plan_courses for insert
  to authenticated with check (user_id = (select auth.uid()));

create policy "users update own courses"
  on public.plan_courses for update
  to authenticated using (user_id = (select auth.uid()));

create policy "users delete own courses"
  on public.plan_courses for delete
  to authenticated using (user_id = (select auth.uid()));

-- Indexes: only user_id for RLS performance (add join indexes when data justifies)
create index idx_semester_plans_user on public.semester_plans(user_id);
create index idx_plan_semesters_user on public.plan_semesters(user_id);
create index idx_plan_courses_user on public.plan_courses(user_id);

-- Reuse existing update_updated_at() trigger from Sprint 1 catalog migration
create trigger semester_plans_updated_at
  before update on public.semester_plans
  for each row execute function update_updated_at();
