-- Add a generated `credits` column to courses, defaulting to credits_min.
-- This fixes Sprint 3 queries that select `credits` but the table only has credits_min/credits_max.
ALTER TABLE courses ADD COLUMN credits numeric(3,1)
  GENERATED ALWAYS AS (credits_min) STORED;
