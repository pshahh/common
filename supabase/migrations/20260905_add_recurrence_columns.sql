-- Recurring model, step 1: the two columns the new model needs.
-- Both nullable, nothing reads them at this point. See
-- docs/recurring-posts-and-boosting.md ("Schema").
--
--   next_occurrence_at - the real date of the next occurrence. NULL on standing
--     offers, which is exactly why they stay out of "Happening soon".
--   resurfaced_at      - what the twice-monthly evergreen job (cron job 3)
--     writes to, instead of overwriting created_at.

alter table public.posts
  add column if not exists next_occurrence_at timestamptz,
  add column if not exists resurfaced_at timestamptz;
