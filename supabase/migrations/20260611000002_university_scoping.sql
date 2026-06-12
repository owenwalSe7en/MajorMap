-- Multi-school scoping groundwork. Must be applied (and the web insert paths
-- deployed) BEFORE any second school is seeded into the shared database.

-- 1. Plans belong to a school. Nullable here because fresh environments run
--    migrations before any university row exists; the web insert paths set it
--    on every new plan, and a follow-up migration can add NOT NULL once all
--    rows carry it. Delete behavior stays NO ACTION (default): removing a
--    university with plans pointing at it should fail loudly.
alter table public.semester_plans
  add column university_id uuid references public.universities(id);

-- Backfill from the plan's program where one exists; everything else predates
-- multi-school and is Utah by construction.
update public.semester_plans sp
set university_id = coalesce(
  (select p.university_id from public.programs p where p.id = sp.program_id),
  (select u.id from public.universities u where u.slug = 'utah')
);

create index idx_semester_plans_university on public.semester_plans (university_id);

-- 2. Soft delete is now policy for catalog rows referenced by user plans.
--    The original ON DELETE CASCADE meant a course deletion silently
--    destroyed rows out of users' plans (via universities → courses it could
--    wipe every plan for a school). RESTRICT turns that into an explicit
--    error forever.
alter table public.plan_courses
  drop constraint plan_courses_course_id_fkey;

alter table public.plan_courses
  add constraint plan_courses_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete restrict;
