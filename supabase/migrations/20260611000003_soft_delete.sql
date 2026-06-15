-- Soft delete for catalog rows. Courses and programs that vanish from a
-- fresh Coursedog fetch are flagged, never deleted — plan_courses references
-- them (RESTRICT) and users keep their history. NOT NULL: a nullable flag
-- gives three-valued logic and every eq(false) filter would silently drop
-- NULL rows.

alter table public.courses
  add column if not exists is_discontinued boolean not null default false;

alter table public.programs
  add column if not exists is_discontinued boolean not null default false;

-- Browse/search/suggestions filter on this in every query.
create index if not exists idx_courses_active
  on public.courses (university_id)
  where not is_discontinued;

create index if not exists idx_programs_active
  on public.programs (university_id)
  where not is_discontinued;
