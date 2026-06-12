-- Requirement-set versioning: insert-new-set-then-flip with exactly one
-- active set per program, enforced by a partial unique index and flipped
-- atomically via an RPC (supabase-js has no client-side transactions).

-- 1. Pre-index cleanup: deactivate all but the newest active set per program.
--    Manually inserted sets default to is_active = true today, so multiple
--    active sets per program may exist and would fail the unique index below.
update public.requirement_sets rs
set is_active = false
where rs.is_active
  and exists (
    select 1
    from public.requirement_sets newer
    where newer.program_id = rs.program_id
      and newer.is_active
      and (newer.captured_at, newer.id) > (rs.captured_at, rs.id)
  );

-- 2. Insert-then-flip model: sets are born inactive. With default true, any
--    insert that forgets the flag either violates the index mid-seed or
--    silently activates an unreviewed set.
alter table public.requirement_sets alter column is_active set default false;

-- 3. version_label is descriptive only. The unique(program_id, version_label)
--    constraint would make every re-seed of the same catalog year fail on
--    insert; correctness is governed by the partial unique index instead.
alter table public.requirement_sets
  drop constraint requirement_sets_program_id_version_label_key;

-- 4. Content hash of the normalized requirement tree — lets the weekly
--    refresh skip insert+flip entirely when nothing changed.
alter table public.requirement_sets add column content_hash text;

-- 5. Exactly one active set per program, ever.
create unique index idx_req_sets_one_active
  on public.requirement_sets (program_id)
  where is_active;

-- 6. The parent_id self-FK cascade does a per-row child lookup on delete;
--    idx_req_items_tree leads with requirement_set_id and cannot serve it.
create index idx_req_items_parent on public.requirement_items (parent_id);

-- 7. Exact duplicate of the index backing unique(university_id, subject_code,
--    number) — pure write amplification on every course upsert.
drop index if exists public.idx_courses_lookup;

-- 8. Batched atomic flip. SECURITY INVOKER: the only caller is the seed
--    running as service_role, which already bypasses RLS — DEFINER would be
--    gratuitous privilege. search_path pinned per Supabase linter rule 0011.
--    The program_id match on the activate UPDATE plus the not-found check
--    prevents cross-program flips and silent zero-row "success"; the advisory
--    lock serializes concurrent seed runs per program (under READ COMMITTED,
--    two concurrent flips can spuriously violate the partial index).
create or replace function public.activate_requirement_sets(p_pairs jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pair record;
begin
  for pair in
    select (e ->> 'program_id')::uuid as program_id,
           (e ->> 'set_id')::uuid as set_id
    from jsonb_array_elements(p_pairs) e
  loop
    perform pg_advisory_xact_lock(hashtextextended(pair.program_id::text, 0));

    update public.requirement_sets
       set is_active = false
     where program_id = pair.program_id
       and is_active;

    update public.requirement_sets
       set is_active = true
     where id = pair.set_id
       and program_id = pair.program_id;

    if not found then
      raise exception 'requirement_set % not found for program %',
        pair.set_id, pair.program_id;
    end if;
  end loop;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default and PostgREST
-- exposes every public function at /rest/v1/rpc/* — without this revoke, any
-- anonymous visitor could flip active requirement sets.
revoke execute on function public.activate_requirement_sets(jsonb)
  from public, anon, authenticated;
grant execute on function public.activate_requirement_sets(jsonb) to service_role;
