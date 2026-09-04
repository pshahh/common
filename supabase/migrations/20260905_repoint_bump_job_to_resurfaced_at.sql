-- Recurring model, step 2: the twice-monthly evergreen bump job (cron job 3)
-- writes resurfaced_at instead of overwriting created_at. Schedule unchanged
-- (0 9 1,15 * *). See docs/recurring-posts-and-boosting.md ("Order of work").
--
-- Pairs with the "Recently added" sort in app/page.tsx, which now orders on the
-- later of created_at and resurfaced_at. Both halves must ship together: the
-- job alone stops standing offers surfacing, the sort alone does nothing.
--
-- Applied to production via cron.alter_job (the MCP role cannot UPDATE
-- cron.job directly). Recorded here so the change is in version control.

select cron.alter_job(
  3,
  command := $cmd$
    UPDATE posts
    SET resurfaced_at = NOW()
    WHERE recurrence_rule IS NOT NULL
      AND status = 'approved'
      AND expires_at > '2098-01-01'
      AND parent_post_id IS NULL;
  $cmd$
);
