-- ROLLBACK for 20260917_remove_thread_autoclose.sql.
--
-- Recreates close_expired_threads() verbatim, re-enables cron job 1, and
-- restores every closed_at value from the backup table the forward migration
-- wrote. Pure UPDATE plus CREATE OR REPLACE -- no row was ever deleted, so
-- nothing needs recreating besides the function. Safe to run more than once.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('backup.threads_closed_at_20260917') IS NULL THEN
    RAISE EXCEPTION 'Backup table missing -- cannot roll back safely.';
  END IF;
END
$guard$;

-- 1. Recreate the function exactly as it was.
CREATE OR REPLACE FUNCTION public.close_expired_threads()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE threads t
  SET closed_at = NOW()
  FROM posts p
  WHERE t.post_id = p.id
    AND t.closed_at IS NULL
    AND p.expires_at IS NOT NULL
    AND p.expires_at < NOW() - INTERVAL '24 hours';
END;
$function$;

-- 2. Re-enable the cron job.
SELECT cron.alter_job(1, active := true);

-- 3. Restore closed_at.
UPDATE threads t
SET closed_at = b.closed_at
FROM backup.threads_closed_at_20260917 b
WHERE t.id = b.thread_id
  AND t.closed_at IS DISTINCT FROM b.closed_at;

COMMIT;
