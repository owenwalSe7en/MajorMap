-- Sprint 5: Add status and grade columns to plan_courses for transcript import
-- Allows marking courses as completed with a grade

ALTER TABLE public.plan_courses
  ADD COLUMN status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed')),
  ADD COLUMN grade text
    CHECK (grade IN ('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','CR','NC','NP','P','S','U','W','I'));

-- Enforce: planned courses have no grade, completed courses always have one
ALTER TABLE public.plan_courses
  ADD CONSTRAINT chk_status_grade_consistency
    CHECK (
      (status = 'planned' AND grade IS NULL)
      OR (status = 'completed' AND grade IS NOT NULL)
    );
