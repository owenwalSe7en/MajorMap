-- Sprint 1: Catalog schema for University of Utah course/program data
-- 7 tables: universities, departments, courses, course_prerequisites, programs, requirement_sets, requirement_items

-- Trigger function for auto-updating updated_at timestamps
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Universities
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  coursedog_school_id text,
  catalog_url text,
  created_at timestamptz not null default now()
);

-- 2. Departments
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  code text not null,
  name text not null,
  unique(university_id, code)
);

-- 3. Courses
create table public.courses (
  id uuid primary key,
  university_id uuid not null references universities(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  subject_code text not null,
  number text not null,
  code text generated always as (subject_code || ' ' || number) stored,
  title text not null,
  description text not null default '',
  credits_min numeric(3,1) not null,
  credits_max numeric(3,1) not null,
  typically_offered text[] not null default '{}',
  coursedog_id text,
  course_group_id text,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  raw_data jsonb,
  updated_at timestamptz not null default now(),
  unique(university_id, subject_code, number),
  check (credits_min <= credits_max)
);

create trigger courses_updated_at before update on courses
  for each row execute function update_updated_at();

-- 4. Course Prerequisites
create table public.course_prerequisites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  prerequisite_course_id uuid references courses(id) on delete cascade,
  group_id text not null,
  group_operator text not null default 'AND',
  condition text not null,
  min_grade text,
  is_corequisite boolean not null default false,
  description_override text,
  raw_rule jsonb,
  unique(course_id, prerequisite_course_id, group_id)
);

-- 5. Programs
create table public.programs (
  id uuid primary key,
  university_id uuid not null references universities(id) on delete cascade,
  slug text not null,
  name text not null,
  degree_type text not null,
  description text not null default '',
  total_credits integer,
  source_url text,
  raw_data jsonb,
  updated_at timestamptz not null default now(),
  unique(university_id, slug)
);

create trigger programs_updated_at before update on programs
  for each row execute function update_updated_at();

-- 6. Requirement Sets (versioned snapshots)
create table public.requirement_sets (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  version_label text not null,
  captured_at timestamptz not null default now(),
  source_urls text[] not null default '{}',
  is_active boolean not null default true,
  unique(program_id, version_label)
);

-- 7. Requirement Items (tree via parent_id)
create table public.requirement_items (
  id uuid primary key default gen_random_uuid(),
  requirement_set_id uuid not null references requirement_sets(id) on delete cascade,
  parent_id uuid references requirement_items(id) on delete cascade,
  sort_order integer not null default 0,
  label text not null,
  type text not null,
  course_id uuid references courses(id) on delete set null,
  credits_required numeric,
  courses_required integer,
  description text,
  raw_rule jsonb
);

-- Enable RLS on all tables
alter table public.universities enable row level security;
alter table public.departments enable row level security;
alter table public.courses enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.programs enable row level security;
alter table public.requirement_sets enable row level security;
alter table public.requirement_items enable row level security;

-- Public read policies (separate per role per Supabase best practices)
create policy "anon select universities" on public.universities for select to anon using (true);
create policy "auth select universities" on public.universities for select to authenticated using (true);
create policy "anon select departments" on public.departments for select to anon using (true);
create policy "auth select departments" on public.departments for select to authenticated using (true);
create policy "anon select courses" on public.courses for select to anon using (true);
create policy "auth select courses" on public.courses for select to authenticated using (true);
create policy "anon select prereqs" on public.course_prerequisites for select to anon using (true);
create policy "auth select prereqs" on public.course_prerequisites for select to authenticated using (true);
create policy "anon select programs" on public.programs for select to anon using (true);
create policy "auth select programs" on public.programs for select to authenticated using (true);
create policy "anon select req_sets" on public.requirement_sets for select to anon using (true);
create policy "auth select req_sets" on public.requirement_sets for select to authenticated using (true);
create policy "anon select req_items" on public.requirement_items for select to anon using (true);
create policy "auth select req_items" on public.requirement_items for select to authenticated using (true);

-- Indexes
create index idx_courses_lookup on courses(university_id, subject_code, number);
create index idx_courses_search on courses using gin(search_vector);
create index idx_courses_group_id on courses(course_group_id);
create index idx_prereqs_course on course_prerequisites(course_id);
create index idx_prereqs_prereq on course_prerequisites(prerequisite_course_id);
create index idx_programs_browse on programs(university_id, degree_type);
create index idx_req_items_tree on requirement_items(requirement_set_id, parent_id, sort_order);
