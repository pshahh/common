-- Shared recurrence roll-forward, used by BOTH the chain-collapse backfill
-- (20260906_collapse_recurring_chains.sql) and the rewritten
-- generate_recurring_posts. Single definition on purpose: the two computed the
-- same date independently once, and would drift the moment either changed.
--
-- Occurrence dates, not expiries. A listing's expiry is always its occurrence
-- date plus one day; callers add that themselves.

CREATE OR REPLACE FUNCTION recurrence_interval_days(p_recurrence_rule text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_recurrence_rule
           WHEN 'weekly'   THEN 7
           WHEN 'biweekly' THEN 14
           WHEN 'monthly'  THEN 30
           ELSE 7
         END;
$$;

COMMENT ON FUNCTION recurrence_interval_days(text) IS
  'Days between occurrences for a posts.recurrence_rule value. Unknown rules fall back to weekly, matching the original generate_recurring_posts.';

-- Given the last occurrence date and a recurrence rule, return the first
-- occurrence falling on or after p_from_date, stepping in whole intervals.
--
-- GREATEST(..., 1) guarantees the result always moves at least one interval
-- forward, so a listing whose occurrence is today still rolls to the next one
-- rather than returning today and never advancing.
CREATE OR REPLACE FUNCTION next_occurrence_after(
  p_last_occurrence date,
  p_recurrence_rule text,
  p_from_date       date
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_last_occurrence + (
           recurrence_interval_days(p_recurrence_rule) * GREATEST(
             ceil(
               (p_from_date - p_last_occurrence)::numeric
               / recurrence_interval_days(p_recurrence_rule)
             ),
             1
           )::int
         );
$$;

COMMENT ON FUNCTION next_occurrence_after(date, text, date) IS
  'First occurrence on or after p_from_date, stepping from p_last_occurrence in whole recurrence intervals. Shared by the chain-collapse backfill and generate_recurring_posts so the two cannot diverge.';
