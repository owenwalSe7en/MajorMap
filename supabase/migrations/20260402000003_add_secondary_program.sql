-- Sprint 7: Allow plans to track a secondary program (double major / minor)
ALTER TABLE public.semester_plans
  ADD COLUMN secondary_program_id uuid
    REFERENCES public.programs(id) ON DELETE SET NULL;
