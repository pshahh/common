-- Remove the 24-hour post-expiry auto-close for message threads.
--
-- close_expired_threads() (cron job 1, hourly, '0 * * * *') was setting
-- threads.closed_at 24h after the linked post's expires_at, which silently
-- ended live conversations -- 87 of 161 threads are closed at the time of
-- this migration, and at least one was cut off mid-conversation. Threads now
-- stay open indefinitely. The only thing that still marks a thread "closed"
-- client-side is its post's own status ('closed'), which this migration does
-- not touch.
--
-- Reversible by
-- supabase/migrations/20260917_remove_thread_autoclose_rollback.sql, a pure
-- UPDATE from the backup table this migration writes first.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Guards. Fail loudly rather than run against unexpected state.
-- ---------------------------------------------------------------------------
DO $guard$
DECLARE
  n_job int;
  n_closed int;
BEGIN
  SELECT count(*) INTO n_job
  FROM cron.job
  WHERE jobid = 1 AND jobname = 'close-expired-threads';

  IF n_job <> 1 THEN
    RAISE EXCEPTION
      'Expected cron job 1 to be close-expired-threads, found % matching.', n_job;
  END IF;

  SELECT count(*) INTO n_closed FROM threads WHERE closed_at IS NOT NULL;
  IF n_closed = 0 THEN
    RAISE EXCEPTION 'No closed threads found -- re-verify before running.';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. Backup, in its own schema (not public) so rollback is a pure UPDATE and
--    the backed-up values are never exposed over PostgREST.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS backup;

DROP TABLE IF EXISTS backup.threads_closed_at_20260917;
CREATE TABLE backup.threads_closed_at_20260917 AS
SELECT id AS thread_id, closed_at
FROM threads
WHERE closed_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Reopen every thread the cron job had closed.
-- ---------------------------------------------------------------------------
UPDATE threads
SET closed_at = NULL
WHERE closed_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Disable the cron job (kept, inactive, so its schedule/history stays
--    inspectable) and drop the function it called. Nothing else in the
--    codebase references close_expired_threads.
-- ---------------------------------------------------------------------------
SELECT cron.alter_job(1, active := false);
DROP FUNCTION IF EXISTS public.close_expired_threads();

COMMIT;
